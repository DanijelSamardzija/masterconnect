-- Add p_days parameter to boost_post so callers can choose duration.
-- Prices are validated server-side; invalid values fall back to cheapest option.
-- Feed (social_post):  3d=75, 7d=150, 30d=450
-- Listings:            7d=140, 14d=260, 30d=600

CREATE OR REPLACE FUNCTION boost_post(
  p_user_id uuid,
  p_post_id uuid,
  p_days    integer DEFAULT 3
)
RETURNS jsonb AS $$
DECLARE
  v_post_type      text;
  v_post_owner     uuid;
  v_cost           integer;
  v_days_val       integer;
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

  IF v_post_type IN ('service_listing', 'hiring_post', 'job_seeker_post', 'service_request') THEN
    IF p_days = 14 THEN
      v_cost := 260; v_days_val := 14;
    ELSIF p_days = 30 THEN
      v_cost := 600; v_days_val := 30;
    ELSE
      v_cost := 140; v_days_val := 7;
    END IF;
  ELSE
    IF p_days = 7 THEN
      v_cost := 150; v_days_val := 7;
    ELSIF p_days = 30 THEN
      v_cost := 450; v_days_val := 30;
    ELSE
      v_cost := 75; v_days_val := 3;
    END IF;
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

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

  UPDATE posts
  SET promoted_until = GREATEST(COALESCE(promoted_until, now()), now()) + (v_days_val || ' days')::interval
  WHERE id = p_post_id
  RETURNING promoted_until INTO v_promoted_until;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'boost_post:' || p_post_id::text || ':' || v_days_val || 'd', 'completed');

  RETURN jsonb_build_object(
    'ok',             true,
    'cost',           v_cost,
    'days',           v_days_val,
    'promoted_until', v_promoted_until
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
