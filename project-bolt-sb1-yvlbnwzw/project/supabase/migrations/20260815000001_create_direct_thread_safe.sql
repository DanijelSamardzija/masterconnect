-- Anti-spam: prevent new accounts from mass-initiating direct DM threads
--
-- Rule: accounts < 48h old may initiate at most 3 new direct threads per rolling 24h.
-- Existing threads are returned without counting against the limit.
-- Replies to existing threads are not affected (they touch messages, not threads).
-- Post/job threads remain unrestricted.
--
-- Enforcement layers:
--   1. SECURITY DEFINER function — all checks run server-side, cannot be bypassed
--   2. Tightened threads INSERT RLS — blocks direct client INSERT for thread_type='direct'
--
-- Locking strategy (two independent levels, different PostgreSQL lock namespaces):
--
--   Level 1 — CALLER lock (bigint namespace):
--     Key: hashtext(caller_id::text)::bigint
--     Scope: all concurrent requests from the same new account, regardless of target.
--     Why: without this, A→B and A→C can both pass COUNT simultaneously,
--          allowing the limit to be exceeded in parallel.
--     Applies to: new accounts only (< 48h). Old accounts skip this lock entirely.
--
--   Level 2 — PAIR lock ((int4, int4) namespace):
--     Key: (hashtext(LEAST(a,b)), hashtext(GREATEST(a,b)))
--     Scope: concurrent requests for the same user pair, regardless of direction.
--     Why: prevents A→B and B→A from both INSERTing and creating duplicate threads.
--     Applies to: all accounts.
--
--   Namespace note: PostgreSQL advisory locks use SEPARATE namespaces for the
--   bigint form and the (int4, int4) form. There is no collision between Level 1
--   and Level 2 keys even if hash values coincide numerically.
--
--   Deadlock analysis: impossible. Thread 1 holds caller_lock(A) then wants
--   pair_lock(A,B). Thread 2 holds caller_lock(B) then wants pair_lock(A,B).
--   Both wait for the same pair lock — no circular dependency.

-- ============================================================
-- 1. SECURITY DEFINER RPC
-- ============================================================
CREATE OR REPLACE FUNCTION create_direct_thread_safe(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id     uuid;
  v_account_age_h numeric;
  v_threads_24h   integer;
  v_thread_id     uuid;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_message_self');
  END IF;

  -- Target must exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_not_found');
  END IF;

  -- Honour block system (either direction)
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_user_id = v_caller_id      AND blocked_user_id = p_target_user_id)
       OR (blocker_user_id = p_target_user_id AND blocked_user_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'blocked');
  END IF;

  -- ── Fast path ────────────────────────────────────────────────────────────
  -- Check before acquiring any lock. The thread cannot disappear once created,
  -- so a positive result here is always safe to return.
  SELECT id INTO v_thread_id
  FROM threads
  WHERE thread_type = 'direct'
    AND job_id  IS NULL
    AND post_id IS NULL
    AND (
      (user1_id = v_caller_id      AND user2_id = p_target_user_id) OR
      (user1_id = p_target_user_id AND user2_id = v_caller_id)
    )
  LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'thread_id', v_thread_id, 'is_new', false);
  END IF;

  -- ── Account age ──────────────────────────────────────────────────────────
  SELECT EXTRACT(EPOCH FROM (now() - created_at)) / 3600
  INTO v_account_age_h
  FROM profiles
  WHERE id = v_caller_id;

  -- ── Level 1: CALLER lock (new accounts only) ─────────────────────────────
  -- Serialises all concurrent direct-thread creation attempts from this caller.
  -- Ensures A→B and A→C cannot both pass the COUNT check simultaneously.
  -- Uses the bigint advisory lock namespace (distinct from the pair lock below).
  IF COALESCE(v_account_age_h, 0) < 48 THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_caller_id::text)::bigint);

    -- Re-check: a concurrent request from this same caller may have created
    -- this exact thread while we were waiting for the caller lock.
    SELECT id INTO v_thread_id
    FROM threads
    WHERE thread_type = 'direct'
      AND job_id  IS NULL
      AND post_id IS NULL
      AND (
        (user1_id = v_caller_id      AND user2_id = p_target_user_id) OR
        (user1_id = p_target_user_id AND user2_id = v_caller_id)
      )
    LIMIT 1;

    IF v_thread_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'thread_id', v_thread_id, 'is_new', false);
    END IF;

    -- Count new direct threads this caller initiated in the last 24h.
    -- Serialised by the caller lock: only one request reaches this point at a time.
    -- Post-migration: user1_id = caller for all threads created through this function.
    SELECT COUNT(*) INTO v_threads_24h
    FROM threads
    WHERE thread_type = 'direct'
      AND user1_id   = v_caller_id
      AND created_at > now() - interval '24 hours';

    IF v_threads_24h >= 3 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'new_account_limit_reached');
    END IF;
  END IF;

  -- ── Level 2: PAIR lock (all accounts) ───────────────────────────────────
  -- Serialises concurrent creation of the same user pair regardless of direction.
  -- Prevents A→B and B→A from both INSERTing and creating duplicate threads.
  -- Uses the (int4, int4) advisory lock namespace — different from Level 1.
  -- LEAST/GREATEST ensures identical lock key for both A→B and B→A requests.
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(v_caller_id::text, p_target_user_id::text)),
    hashtext(GREATEST(v_caller_id::text, p_target_user_id::text))
  );

  -- Final re-check: the other party may have created the thread from their side
  -- while the caller was inside the caller lock or waiting for the pair lock.
  SELECT id INTO v_thread_id
  FROM threads
  WHERE thread_type = 'direct'
    AND job_id  IS NULL
    AND post_id IS NULL
    AND (
      (user1_id = v_caller_id      AND user2_id = p_target_user_id) OR
      (user1_id = p_target_user_id AND user2_id = v_caller_id)
    )
  LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'thread_id', v_thread_id, 'is_new', false);
  END IF;

  -- INSERT — caller is always user1_id so rate-limit counting stays accurate.
  -- The on_thread_created trigger inserts thread_participants for both users.
  INSERT INTO threads (user1_id, user2_id, thread_type)
  VALUES (v_caller_id, p_target_user_id, 'direct')
  RETURNING id INTO v_thread_id;

  RETURN jsonb_build_object('ok', true, 'thread_id', v_thread_id, 'is_new', true);
END;
$$;

GRANT EXECUTE ON FUNCTION create_direct_thread_safe(uuid) TO authenticated;

-- ============================================================
-- 2. RLS failsafe — deny direct client INSERT for thread_type='direct'
--
-- SECURITY DEFINER functions bypass RLS, so create_direct_thread_safe can
-- still INSERT. Authenticated clients can no longer INSERT direct threads
-- without going through the function.
--
-- Other thread types (post, job, adult_inquiry) are unaffected.
-- ============================================================
DROP POLICY IF EXISTS "Users can create threads" ON threads;

CREATE POLICY "Users can create non-direct threads" ON threads
  FOR INSERT TO authenticated
  WITH CHECK (
    thread_type <> 'direct'
    AND (auth.uid() = user1_id OR auth.uid() = user2_id)
  );
