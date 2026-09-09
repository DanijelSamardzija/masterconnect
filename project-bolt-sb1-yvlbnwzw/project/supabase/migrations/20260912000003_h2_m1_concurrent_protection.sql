-- H2 + M1: Concurrent-request protection for boost purchase and premium upgrade
-- ─────────────────────────────────────────────────────────────────────────────
-- H2  /api/ai-match/boost  POST had three separate DB round-trips
--     (SELECT active-boost check  →  deduct_credits_atomic  →  INSERT boost).
--     Two concurrent requests could both pass the SELECT check, each deduct 30cr,
--     and each insert a boost row → user charged 60cr for one boost.
--
-- Fix: new SECURITY DEFINER function create_ai_match_boost wraps all three
--     operations inside one transaction and acquires a pg_advisory_xact_lock
--     keyed on the profile_id before the active-boost check.  The lock is held
--     until the transaction commits, so the second concurrent call blocks and,
--     on release, sees the already-active boost and returns boost_already_active.
--
-- M1  become_creator_premium had the same TOCTOU pattern:
--     SELECT is_premium  →  UPDATE credits_balance  →  UPDATE profiles.
--     With balance ≥ 1000 two concurrent calls could both read is_premium = false
--     and both deduct 500cr.
--
-- Fix: add SELECT … FOR UPDATE on the profiles row immediately after the auth
--     guard.  The row-lock serializes concurrent calls: the second caller blocks
--     until the first commits (which sets is_premium = true), then reads the
--     updated value and returns already_creator_premium.
--
-- Prices, logic, and existing credit_transaction descriptions are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── H2: create_ai_match_boost ───────────────────────────────────────────────
-- Called exclusively from the server-side API route (/api/ai-match/boost POST)
-- via serviceClient (service_role).  No auth.uid() guard is needed here because
-- the route has already validated the caller's JWT before passing the UUID.
-- Access is restricted to service_role via REVOKE/GRANT below.
CREATE OR REPLACE FUNCTION create_ai_match_boost(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cost        integer     := 30;
  v_score       integer     := 15;
  v_days        integer     := 7;
  v_valid_until timestamptz;
  v_boost_id    uuid;
  v_new_balance integer;
  v_actual_bal  integer;
BEGIN
  -- Transaction-scoped advisory lock — serializes concurrent calls per profile.
  -- hashtext returns int4; cast to bigint matches pg_advisory_xact_lock(bigint).
  -- The 'aib:' prefix namespaces these locks from any other advisory-lock users.
  PERFORM pg_advisory_xact_lock(hashtext('aib:' || p_profile_id::text)::bigint);

  -- Active-boost check runs inside the lock, eliminating the TOCTOU window.
  SELECT valid_until
  INTO   v_valid_until
  FROM   matchmaking_boosts
  WHERE  profile_id = p_profile_id
    AND  valid_until > now()
  ORDER  BY valid_until DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',          false,
      'error',       'boost_already_active',
      'valid_until', v_valid_until
    );
  END IF;

  -- Ensure a credits_balance row exists before deducting.
  PERFORM ensure_credits_balance(p_profile_id);

  -- Atomic deduction — the WHERE balance >= v_cost guard prevents overdraft.
  UPDATE credits_balance
  SET    balance    = balance - v_cost,
         updated_at = now()
  WHERE  user_id = p_profile_id
    AND  balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_bal
    FROM   credits_balance
    WHERE  user_id = p_profile_id;

    RETURN jsonb_build_object(
      'ok',       false,
      'error',    'insufficient_credits',
      'balance',  COALESCE(v_actual_bal, 0),
      'required', v_cost
    );
  END IF;

  -- Insert the boost row.
  v_valid_until := now() + (v_days || ' days')::interval;

  INSERT INTO matchmaking_boosts (profile_id, credits_spent, boost_score, valid_until)
  VALUES (p_profile_id, v_cost, v_score, v_valid_until)
  RETURNING id INTO v_boost_id;

  -- Log the spend.
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_profile_id, -v_cost, 'spend', 'ai_match_boost');

  RETURN jsonb_build_object(
    'ok',            true,
    'boost',         jsonb_build_object(
                       'id',            v_boost_id,
                       'profile_id',    p_profile_id,
                       'credits_spent', v_cost,
                       'boost_score',   v_score,
                       'valid_until',   v_valid_until
                     ),
    'credits_spent', v_cost
  );
END;
$$;

-- Direct calls from authenticated clients are not allowed.
REVOKE EXECUTE ON FUNCTION create_ai_match_boost(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_ai_match_boost(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION create_ai_match_boost(uuid) TO service_role;

-- ─── M1: become_creator_premium — SELECT FOR UPDATE ───────────────────────────
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_already_premium boolean;
  v_new_balance     integer;
  v_actual_balance  integer;
  v_cost            integer := 500;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- FOR UPDATE locks this profiles row for the duration of the transaction.
  -- A concurrent call blocks here until the first call commits.
  -- After commit, the second caller reads is_premium = true and short-circuits.
  SELECT is_premium INTO v_already_premium
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF COALESCE(v_already_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  UPDATE credits_balance
  SET    balance    = balance - v_cost,
         updated_at = now()
  WHERE  user_id = p_user_id
    AND  balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_balance
    FROM   credits_balance
    WHERE  user_id = p_user_id;

    RETURN jsonb_build_object(
      'ok',      false,
      'error',   'insufficient_balance',
      'balance', COALESCE(v_actual_balance, 0),
      'needed',  v_cost
    );
  END IF;

  UPDATE profiles SET is_premium = true WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'PRO Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$;
