-- Fix status constraint (values must match what earn_reward/send_credits insert)
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_status_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));

-- Add missing UPDATE policy on profiles (needed for upsert from client)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Make handle_new_user_credits resilient: if earn_reward fails, don't block profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.earn_reward(NEW.id, 'registration');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_credits failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Fix send_credits: allow any positive amount (not just 5/10/20)
CREATE OR REPLACE FUNCTION send_credits(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer
)
RETURNS jsonb AS $$
DECLARE
  v_sender_balance   integer;
  v_receiver_premium boolean;
  v_fee              integer;
  v_net              integer;
  v_sender_name      text;
BEGIN
  IF p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT is_pro INTO v_receiver_premium FROM profiles WHERE id = p_receiver_id;
  IF NOT COALESCE(v_receiver_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receiver_not_creator_premium');
  END IF;

  PERFORM ensure_credits_balance(p_sender_id);
  PERFORM ensure_credits_balance(p_receiver_id);

  SELECT balance INTO v_sender_balance FROM credits_balance WHERE user_id = p_sender_id;
  IF v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  v_fee := GREATEST(1, ROUND(p_amount * 0.15));
  v_net := p_amount - v_fee;

  UPDATE credits_balance SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_sender_id;
  UPDATE credits_balance SET balance = balance + v_net,    updated_at = now() WHERE user_id = p_receiver_id;

  SELECT name INTO v_sender_name FROM profiles WHERE id = p_sender_id;

  INSERT INTO credit_transactions (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status)
  VALUES (p_sender_id, p_sender_id, p_receiver_id, -p_amount, v_fee, 'spend', 'Podrška poslata', 'completed');

  INSERT INTO credit_transactions (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status)
  VALUES (p_receiver_id, p_sender_id, p_receiver_id, v_net, v_fee, 'support', 'Primljena podrška', 'completed');

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (p_receiver_id, 'credit', 'credit_received',
    COALESCE(v_sender_name, 'Neko') || ' vam je poslao ' || p_amount || ' kredita',
    'GigZone krediti • ' || v_net || ' kredita dodato na vaš balans',
    jsonb_build_object('sender_id', p_sender_id, 'amount', p_amount, 'net', v_net, 'fee', v_fee)
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'net', v_net);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
