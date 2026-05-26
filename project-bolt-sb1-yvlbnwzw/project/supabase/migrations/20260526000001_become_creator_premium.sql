-- ============================================================
-- FUNCTION: become_creator_premium
-- Deducts 100 demo credits and grants Creator Premium status.
-- Returns ok:true on success, or error key on failure.
-- ============================================================
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_balance        integer;
  v_already_premium boolean;
  v_cost           integer := 100;
BEGIN
  -- Check if already Creator Premium
  SELECT is_creator_premium INTO v_already_premium
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
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'needed', v_cost, 'have', v_balance);
  END IF;

  -- Deduct credits
  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id;

  -- Grant Creator Premium
  UPDATE profiles
  SET is_creator_premium = true
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'Creator Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
