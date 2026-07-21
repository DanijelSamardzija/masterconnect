-- Fix race condition in become_creator_premium.
-- Replaces SELECT + check + UPDATE pattern with single atomic UPDATE + RETURNING.
-- A concurrent request cannot pass the balance check after another has already deducted.

CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_already_premium boolean;
  v_new_balance     integer;
  v_actual_balance  integer;
  v_cost            integer := 200;
BEGIN
  -- Check if already PRO (not a balance operation, safe as plain SELECT)
  SELECT is_premium INTO v_already_premium FROM profiles WHERE id = p_user_id;

  IF COALESCE(v_already_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  -- Atomic deduction: deduct only if balance >= cost in a single statement.
  -- No separate SELECT means no window for a concurrent request to pass this check.
  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id AND balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_balance FROM credits_balance WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'balance', COALESCE(v_actual_balance, 0),
      'needed', v_cost
    );
  END IF;

  UPDATE profiles SET is_premium = true WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'PRO Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
