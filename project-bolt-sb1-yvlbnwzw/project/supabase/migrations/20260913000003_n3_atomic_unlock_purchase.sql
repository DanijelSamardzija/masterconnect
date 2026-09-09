-- N3: Replace the three-step unlock flow with an atomic SECURITY DEFINER function.
--
-- PROBLEM: /api/ai-match/unlock has a TOCTOU race:
--   1. SELECT check (already unlocked?)   ←─ both concurrent requests pass
--   2. deduct_credits_atomic (50 cr)      ←─ both deduct → 100 cr total
--   3. INSERT matchmaking_unlock_log      ←─ T1 OK, T2 gets 23505 silently
-- Result: user charged 100 cr for one unlock. matchmaking_unlock_log has a
-- UNIQUE(user_id, post_id) constraint that blocks the second INSERT, but the
-- deduction has already happened by then.
--
-- FIX: new SECURITY DEFINER function purchase_ai_match_unlock wraps all three
-- operations inside one transaction, guarded by a pg_advisory_xact_lock keyed
-- on (user_id, post_id). The second concurrent call blocks on the lock; after
-- the first commits, the second reads the existing log row and returns
-- already_unlocked without touching credits.
--
-- SAME PATTERN AS H2 (create_ai_match_boost in 20260912000003).
-- Prices and business logic unchanged: UNLOCK_COST = 50.

CREATE OR REPLACE FUNCTION public.purchase_ai_match_unlock(
  p_user_id uuid,
  p_post_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost        integer := 50;
  v_new_balance integer;
  v_actual_bal  integer;
BEGIN
  -- Transaction-scoped advisory lock per (user_id, post_id).
  -- The 'amu:' prefix namespaces these locks from boost and other advisory users.
  -- hashtext(text) returns int4; CAST to bigint to match pg_advisory_xact_lock(bigint).
  PERFORM pg_advisory_xact_lock(
    hashtext('amu:' || p_user_id::text || ':' || p_post_id::text)::bigint
  );

  -- Already unlocked? Return idempotent success without charging.
  -- This check runs inside the lock, so a concurrent call that reaches here
  -- after the first has committed will see the log row and short-circuit.
  IF EXISTS (
    SELECT 1 FROM matchmaking_unlock_log
    WHERE user_id = p_user_id AND post_id = p_post_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_unlocked', true);
  END IF;

  -- Atomic deduction — WHERE balance >= v_cost prevents overdraft.
  UPDATE credits_balance
  SET    balance    = balance - v_cost,
         updated_at = now()
  WHERE  user_id = p_user_id
    AND  balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_bal
    FROM   credits_balance
    WHERE  user_id = p_user_id;

    RETURN jsonb_build_object(
      'ok',       false,
      'error',    'insufficient_credits',
      'balance',  COALESCE(v_actual_bal, 0),
      'required', v_cost
    );
  END IF;

  -- Log the spend (matches deduct_credits_atomic's pattern).
  INSERT INTO credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, -v_cost, 'spend', 'ai_match_unlock', p_post_id);

  -- Record the unlock — this is now inside the lock so 23505 cannot happen.
  INSERT INTO matchmaking_unlock_log (user_id, post_id, credits_spent)
  VALUES (p_user_id, p_post_id, v_cost);

  RETURN jsonb_build_object(
    'ok',            true,
    'already_unlocked', false,
    'credits_spent', v_cost
  );
END;
$$;

-- Direct calls from authenticated clients are not allowed.
-- The API route (/api/ai-match/unlock) uses service_role after JWT validation.
REVOKE EXECUTE ON FUNCTION public.purchase_ai_match_unlock(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_ai_match_unlock(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.purchase_ai_match_unlock(uuid, uuid) TO service_role;
