-- ============================================================
-- FUNCTION: earn_post_reward
-- Awards credits when a user publishes a post with media.
-- Image: +5 credits, max 2x per day
-- Video: +10 credits, max 1x per day
-- Text-only posts: no reward
-- ============================================================
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
  -- Map media type to reward
  IF p_media_type = 'image' THEN
    v_amount    := 5;
    v_max_daily := 2;
    v_desc      := 'Post nagrada: slika';
  ELSIF p_media_type = 'video' THEN
    v_amount    := 10;
    v_max_daily := 1;
    v_desc      := 'Post nagrada: video';
  ELSE
    RETURN 0;
  END IF;

  -- Ensure balance row exists
  PERFORM ensure_credits_balance(p_user_id);

  -- Count today's rewards of this type
  SELECT COUNT(*) INTO v_count
  FROM credit_transactions
  WHERE user_id    = p_user_id
    AND type       = 'earn'
    AND description = v_desc
    AND created_at >= v_today
    AND created_at <  v_today + interval '1 day';

  IF v_count >= v_max_daily THEN
    RETURN 0; -- daily limit reached
  END IF;

  -- Credit balance
  UPDATE credits_balance
  SET balance = balance + v_amount, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, v_amount, 'earn', v_desc, 'completed');

  RETURN v_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
