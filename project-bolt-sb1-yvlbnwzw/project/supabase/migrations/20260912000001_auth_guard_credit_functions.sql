-- C1 + C2 + H1 Security Fix
-- ─────────────────────────────────────────────────────────────────────────────
-- Three DB functions accepted an explicit user-id parameter without verifying
-- that the RPC caller owns that account. Any authenticated user could supply a
-- victim's UUID and spend the victim's credits.
--
-- Fix applied to all three:
--   Add an identity guard as the FIRST statement inside each function.
--   auth.uid() IS DISTINCT FROM <param> evaluates to TRUE when:
--     • auth.uid() is NULL  (unauthenticated / service-role raw session)
--     • auth.uid() is a different UUID than the claimed owner
--   In both cases the function raises 'forbidden' before touching any row.
--
-- Existing signatures, return types, prices, logic, and credit_transactions
-- descriptions are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── C1: become_creator_premium ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION become_creator_premium(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_already_premium boolean;
  v_new_balance     integer;
  v_actual_balance  integer;
  v_cost            integer := 500;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT is_premium INTO v_already_premium FROM profiles WHERE id = p_user_id;

  IF COALESCE(v_already_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_user_id);

  UPDATE credits_balance
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id AND balance >= v_cost
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    SELECT balance INTO v_actual_balance FROM credits_balance WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'ok',     false,
      'error',  'insufficient_balance',
      'balance', COALESCE(v_actual_balance, 0),
      'needed',  v_cost
    );
  END IF;

  UPDATE profiles SET is_premium = true WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, -v_cost, 'spend', 'PRO Premium aktivacija', 'completed');

  RETURN jsonb_build_object('ok', true, 'cost', v_cost);
END;
$$;

-- ─── C2: send_credits ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION send_credits(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer,
  p_anonymous   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_sender_balance integer;
  v_receiver_premium   boolean;
  v_fee                integer;
  v_net                integer;
  v_sender_name        text;
  v_notif_title        text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_sender_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT is_premium INTO v_receiver_premium FROM profiles WHERE id = p_receiver_id;
  IF NOT COALESCE(v_receiver_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receiver_not_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_sender_id);
  PERFORM ensure_credits_balance(p_receiver_id);

  v_fee := GREATEST(1, ROUND(p_amount * 0.15));
  v_net := p_amount - v_fee;

  UPDATE credits_balance
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_sender_id AND balance >= p_amount
  RETURNING balance INTO v_new_sender_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE credits_balance
  SET balance = balance + v_net, updated_at = now()
  WHERE user_id = p_receiver_id;

  SELECT name INTO v_sender_name FROM profiles WHERE id = p_sender_id;

  INSERT INTO credit_transactions (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status, anonymous)
  VALUES (p_sender_id, p_sender_id, p_receiver_id, -p_amount, v_fee, 'spend', 'Podrška poslata', 'completed', p_anonymous);

  INSERT INTO credit_transactions (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status, anonymous)
  VALUES (p_receiver_id, p_sender_id, p_receiver_id, v_net, v_fee, 'support', 'Primljena podrška', 'completed', p_anonymous);

  IF p_anonymous THEN
    v_notif_title := 'Primili ste ' || v_net || ' kredita od anonimnog korisnika';
  ELSE
    v_notif_title := COALESCE(v_sender_name, 'Neko') || ' vam je poslao ' || v_net || ' kredita';
  END IF;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    p_receiver_id, 'credit', 'credit_received',
    v_notif_title,
    'Dodato na vaš GigZone balans',
    jsonb_build_object(
      'sender_id', p_sender_id, 'amount', p_amount,
      'net', v_net, 'fee', v_fee, 'anonymous', p_anonymous
    )
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'net', v_net);
END;
$$;

-- ─── H1: boost_post ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION boost_post(
  p_user_id uuid,
  p_post_id uuid,
  p_days    integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_type      text;
  v_post_owner     uuid;
  v_cost           integer;
  v_days_val       integer;
  v_new_balance    integer;
  v_actual_balance integer;
  v_promoted_until timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
  SET promoted_until =
    GREATEST(COALESCE(promoted_until, now()), now()) + (v_days_val || ' days')::interval
  WHERE id = p_post_id
  RETURNING promoted_until INTO v_promoted_until;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (
    p_user_id, -v_cost, 'spend',
    'boost_post:' || p_post_id::text || ':' || v_days_val || 'd',
    'completed'
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'cost',           v_cost,
    'days',           v_days_val,
    'promoted_until', v_promoted_until
  );
END;
$$;
