-- Update boost_post to extend existing boost instead of resetting it.
-- Uses GREATEST(promoted_until, now()) + duration so existing days are never lost.

CREATE OR REPLACE FUNCTION boost_post(p_user_id uuid, p_post_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_post_type      text;
  v_post_owner     uuid;
  v_cost           integer;
  v_duration       interval;
  v_new_balance    integer;
  v_actual_balance integer;
  v_promoted_until timestamptz;
BEGIN
  SELECT user_id, post_type INTO v_post_owner, v_post_type
  FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  IF v_post_owner <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF v_post_type IN ('service_listing', 'hiring_post', 'job_seeker_post') THEN
    v_cost     := 140;
    v_duration := interval '7 days';
  ELSE
    v_cost     := 75;
    v_duration := interval '3 days';
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  -- Atomic deduction
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

  -- Extend: if boost is still active, add to existing date; otherwise start from now
  UPDATE posts
  SET promoted_until = GREATEST(COALESCE(promoted_until, now()), now()) + v_duration
  WHERE id = p_post_id
  RETURNING promoted_until INTO v_promoted_until;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'boost_post:' || p_post_id::text, 'completed');

  RETURN jsonb_build_object(
    'ok',             true,
    'cost',           v_cost,
    'promoted_until', v_promoted_until
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
