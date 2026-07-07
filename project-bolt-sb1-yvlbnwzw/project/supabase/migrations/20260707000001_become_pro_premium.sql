-- ============================================================
-- FUNCTION: become_creator_premium (v3 — PRO Premium)
-- Uses is_pro as the primary status flag.
-- is_creator_premium column kept in DB but no longer used in logic.
-- ============================================================
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_balance         integer;
  v_already_pro     boolean;
  v_cost            integer := 200;
BEGIN
  SELECT is_pro
  INTO v_already_pro
  FROM profiles WHERE id = p_user_id;

  IF COALESCE(v_already_pro, false) THEN
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

  UPDATE profiles
  SET is_pro = true
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'PRO Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
