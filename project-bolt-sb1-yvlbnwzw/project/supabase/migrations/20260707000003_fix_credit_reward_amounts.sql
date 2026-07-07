-- Fix credit reward amounts:
-- Image post: 5 → 2 credits (max 2/day)
-- Video post: 10 → 4 credits (max 1/day)
-- Referral: ensure 20 credits (not 25)
CREATE OR REPLACE FUNCTION earn_post_reward(
  p_user_id   uuid,
  p_media_type text  -- 'image' or 'video'
)
RETURNS integer AS $$
DECLARE
  v_amount    integer;
  v_max_daily integer;
  v_today     date := CURRENT_DATE;
  v_desc      text;
  v_count     integer;
BEGIN
  IF p_media_type = 'image' THEN
    v_amount    := 2;
    v_max_daily := 2;
    v_desc      := 'Post nagrada: slika';
  ELSIF p_media_type = 'video' THEN
    v_amount    := 4;
    v_max_daily := 1;
    v_desc      := 'Post nagrada: video';
  ELSE
    RETURN 0;
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  SELECT COUNT(*) INTO v_count
  FROM credit_transactions
  WHERE user_id    = p_user_id
    AND type       = 'earn'
    AND description = v_desc
    AND created_at >= v_today
    AND created_at <  v_today + interval '1 day';

  IF v_count >= v_max_daily THEN
    RETURN 0;
  END IF;

  UPDATE credits_balance
  SET balance = balance + v_amount, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, v_amount, 'earn', v_desc, 'completed');

  RETURN v_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also ensure referral reward is 20 (fix if still at 25)
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
