-- ============================================================
-- FUNCTION: become_creator_premium (v2)
-- Cost updated to 200 credits.
-- Customers who activate are automatically upgraded to professional.
-- ============================================================
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_balance         integer;
  v_already_premium boolean;
  v_account_type    text;
  v_cost            integer := 200;
BEGIN
  -- Check current state
  SELECT is_creator_premium, account_type
  INTO v_already_premium, v_account_type
  FROM profiles WHERE id = p_user_id;

  IF COALESCE(v_already_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_creator_premium');
  END IF;

  -- Ensure balance row exists
  PERFORM ensure_credits_balance(p_user_id);

  -- Check balance
  SELECT balance INTO v_balance
  FROM credits_balance WHERE user_id = p_user_id;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'balance', v_balance, 'needed', v_cost);
  END IF;

  -- Deduct credits
  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id;

  -- Grant Creator Premium + upgrade to professional if currently customer
  UPDATE profiles
  SET
    is_creator_premium = true,
    account_type = 'professional'
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'become_creator_premium', 'completed');

  RETURN jsonb_build_object(
    'ok', true,
    'cost', v_cost,
    'upgraded_to_professional', v_account_type = 'customer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
