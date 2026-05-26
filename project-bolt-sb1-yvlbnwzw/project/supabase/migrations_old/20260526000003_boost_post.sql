-- Add promoted_until to posts for user self-boost (admin is_promoted stays separate)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS promoted_until timestamptz;

-- Function to boost a post using credits
CREATE OR REPLACE FUNCTION boost_post(p_user_id uuid, p_post_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_post_type text;
  v_post_owner uuid;
  v_cost integer;
  v_duration interval;
  v_balance integer;
BEGIN
  -- Get post info
  SELECT user_id, post_type INTO v_post_owner, v_post_type
  FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  -- Only owner can boost
  IF v_post_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- Set cost and duration based on post type
  IF v_post_type IN ('service_listing', 'hiring_post', 'job_seeker_post') THEN
    v_cost := 25;
    v_duration := interval '7 days';
  ELSE
    v_cost := 15;
    v_duration := interval '3 days';
  END IF;

  -- Check balance
  SELECT balance INTO v_balance
  FROM credits_balance WHERE user_id = p_user_id;

  IF v_balance IS NULL OR v_balance < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'cost', v_cost, 'balance', COALESCE(v_balance, 0));
  END IF;

  -- Deduct credits
  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, description, created_at)
  VALUES (p_user_id, -v_cost, 'boost_post:' || p_post_id::text, now());

  -- Set promoted_until
  UPDATE posts
  SET promoted_until = now() + v_duration
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true, 'cost', v_cost, 'promoted_until', (now() + v_duration));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
