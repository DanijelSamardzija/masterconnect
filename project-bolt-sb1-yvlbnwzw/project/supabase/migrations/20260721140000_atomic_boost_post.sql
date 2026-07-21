-- Complete boost_post migration for active migrations.
-- Adds promoted_until column (was only in migrations_old) and creates
-- boost_post function with atomic UPDATE + RETURNING pattern.

-- Ensure promoted_until column exists on posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS promoted_until timestamptz;

-- Atomic boost_post: replaces SELECT+check+UPDATE with single UPDATE+RETURNING.
-- Costs: 140 credits / 7 days for service_listing, hiring_post, job_seeker_post
--         75 credits / 3 days for all other post types (feed posts)
CREATE OR REPLACE FUNCTION boost_post(p_user_id uuid, p_post_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_post_type    text;
  v_post_owner   uuid;
  v_cost         integer;
  v_duration     interval;
  v_new_balance  integer;
  v_actual_balance integer;
  v_promoted_until timestamptz;
BEGIN
  -- Verify post exists and get owner + type
  SELECT user_id, post_type INTO v_post_owner, v_post_type
  FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  -- Only the owner can boost
  IF v_post_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- Set cost and duration based on post type
  IF v_post_type IN ('service_listing', 'hiring_post', 'job_seeker_post') THEN
    v_cost     := 140;
    v_duration := interval '7 days';
  ELSE
    v_cost     := 75;
    v_duration := interval '3 days';
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  -- Atomic deduction: deduct only if balance >= cost in a single statement
  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id AND balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_balance FROM credits_balance WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'ok',      false,
      'error',   'insufficient_balance',
      'cost',    v_cost,
      'balance', COALESCE(v_actual_balance, 0)
    );
  END IF;

  -- Set promoted_until on the post
  v_promoted_until := now() + v_duration;
  UPDATE posts SET promoted_until = v_promoted_until WHERE id = p_post_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'boost_post:' || p_post_id::text, 'completed');

  RETURN jsonb_build_object(
    'ok',            true,
    'cost',          v_cost,
    'promoted_until', v_promoted_until
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
