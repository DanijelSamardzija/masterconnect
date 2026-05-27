-- Update earn_reward amounts: all onboarding rewards → 5, referral → 20
CREATE OR REPLACE FUNCTION earn_reward(
  p_user_id    uuid,
  p_reward_type text
)
RETURNS integer AS $$
DECLARE
  v_amount integer;
  v_inserted boolean := false;
BEGIN
  v_amount := CASE p_reward_type
    WHEN 'registration'       THEN 5
    WHEN 'first_post'         THEN 5
    WHEN 'first_service'      THEN 5
    WHEN 'first_job'          THEN 5
    WHEN 'profile_completed'  THEN 5
    WHEN 'referral'           THEN 20
    ELSE 0
  END;

  IF v_amount = 0 THEN
    RETURN 0;
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  BEGIN
    INSERT INTO reward_history (user_id, reward_type, amount, claimed)
    VALUES (p_user_id, p_reward_type, v_amount, true);
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN 0;
  END;

  IF v_inserted THEN
    UPDATE credits_balance
    SET balance = balance + v_amount, updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO credit_transactions (user_id, amount, type, description, status)
    VALUES (p_user_id, v_amount, 'earn', 'Nagrada: ' || p_reward_type, 'completed');

    RETURN v_amount;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
