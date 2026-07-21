-- Fix race condition in send_credits.
-- Same atomic UPDATE + RETURNING pattern as become_creator_premium.
-- Logic, fee calculation (15%) and notifications unchanged.

CREATE OR REPLACE FUNCTION send_credits(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer,
  p_anonymous   boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_new_sender_balance integer;
  v_receiver_premium   boolean;
  v_fee                integer;
  v_net                integer;
  v_sender_name        text;
  v_notif_title        text;
BEGIN
  IF p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT is_premium INTO v_receiver_premium FROM profiles WHERE id = p_receiver_id;
  IF NOT COALESCE(v_receiver_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receiver_not_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_sender_id);
  PERFORM ensure_credits_balance(p_receiver_id);

  -- Calculate fee before deduction (does not depend on balance value)
  v_fee := GREATEST(1, ROUND(p_amount * 0.15));
  v_net := p_amount - v_fee;

  -- Atomic deduction: deduct only if balance >= amount in a single statement
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
  VALUES (p_receiver_id, 'credit', 'credit_received',
    v_notif_title,
    'Dodato na vaš GigZone balans',
    jsonb_build_object('sender_id', p_sender_id, 'amount', p_amount, 'net', v_net, 'fee', v_fee, 'anonymous', p_anonymous)
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'net', v_net);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
