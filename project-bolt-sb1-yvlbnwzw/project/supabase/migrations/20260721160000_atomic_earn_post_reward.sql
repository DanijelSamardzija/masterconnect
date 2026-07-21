-- Fix race condition in earn_post_reward.
-- Two simultaneous requests for the same user and media type could both pass
-- the daily COUNT check before either inserted a transaction record, resulting
-- in the daily limit being exceeded. Fix: acquire an advisory lock keyed on
-- (user_id, media_type) so concurrent calls are serialized per user per type.
-- Lock is released automatically when the transaction ends.
-- Business logic (amounts, limits, descriptions) is unchanged.
CREATE OR REPLACE FUNCTION earn_post_reward(
  p_user_id    uuid,
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

  -- Serialize concurrent calls for the same user + media type.
  -- Two simultaneous image uploads from the same user will now run one after
  -- the other, so the second correctly reads the count the first inserted.
  PERFORM pg_advisory_xact_lock(
    ('x' || md5(p_user_id::text || p_media_type))::bit(64)::bigint
  );

  PERFORM ensure_credits_balance(p_user_id);

  SELECT COUNT(*) INTO v_count
  FROM credit_transactions
  WHERE user_id     = p_user_id
    AND type        = 'earn'
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
