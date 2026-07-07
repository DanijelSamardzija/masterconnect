-- ============================================================
-- FUNCTION: become_creator_premium (v3 — PRO Premium)
-- Renamed to PRO Premium. Sets is_pro = true instead of
-- changing account_type. Keeps is_creator_premium for backward
-- compatibility with existing users.
-- ============================================================
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_balance         integer;
  v_already_premium boolean;
  v_cost            integer := 200;
BEGIN
  SELECT is_creator_premium
  INTO v_already_premium
  FROM profiles WHERE id = p_user_id;

  IF COALESCE(v_already_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  SELECT balance INTO v_balance
  FROM credits_balance WHERE user_id = p_user_id;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'balance', v_balance, 'needed', v_cost);
  END IF;

  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id;

  -- Grant PRO Premium: set is_pro = true, keep is_creator_premium for backward compat
  UPDATE profiles
  SET
    is_creator_premium = true,
    is_pro = true
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'PRO Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
