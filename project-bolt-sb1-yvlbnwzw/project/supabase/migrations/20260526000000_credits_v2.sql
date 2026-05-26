-- ============================================================
-- GigZone Credits v2 — Demo/Test System
-- ============================================================

-- 1. Add is_creator_premium to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_creator_premium boolean NOT NULL DEFAULT false;

-- 2. Extend credit_transactions with sender/receiver/fee/status
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS sender_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receiver_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));

-- 3. Reward history table
CREATE TABLE IF NOT EXISTS reward_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN (
    'registration', 'first_post', 'first_service', 'first_job',
    'profile_completed', 'referral', 'admin_grant'
  )),
  amount      integer NOT NULL CHECK (amount > 0),
  claimed     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reward_history_user_id_idx ON reward_history(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS reward_history_user_type_unique
  ON reward_history(user_id, reward_type)
  WHERE reward_type != 'referral' AND reward_type != 'admin_grant';

ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rewards"
  ON reward_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all rewards"
  ON reward_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

GRANT ALL ON reward_history TO service_role;

-- 4. Additional RLS policies for credit_transactions (sender/receiver views)
DROP POLICY IF EXISTS "Users view sent transactions" ON credit_transactions;
CREATE POLICY "Users view sent transactions"
  ON credit_transactions FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users view received transactions" ON credit_transactions;
CREATE POLICY "Users view received transactions"
  ON credit_transactions FOR SELECT TO authenticated
  USING (receiver_id = auth.uid());

-- 5. Insert policy for credits_balance (service role only via functions)
DROP POLICY IF EXISTS "Service role manages balances" ON credits_balance;
CREATE POLICY "Service role manages balances"
  ON credits_balance FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- FUNCTION: ensure_credits_balance
-- Auto-creates a credits_balance row if it doesn't exist
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_credits_balance(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO credits_balance (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: earn_reward
-- Awards demo credits for onboarding actions.
-- Returns the amount earned, or 0 if already claimed.
-- ============================================================
CREATE OR REPLACE FUNCTION earn_reward(
  p_user_id    uuid,
  p_reward_type text
)
RETURNS integer AS $$
DECLARE
  v_amount integer;
  v_inserted boolean := false;
BEGIN
  -- Map reward type to amount
  v_amount := CASE p_reward_type
    WHEN 'registration'       THEN 10
    WHEN 'first_post'         THEN 15
    WHEN 'first_service'      THEN 20
    WHEN 'first_job'          THEN 20
    WHEN 'profile_completed'  THEN 10
    WHEN 'referral'           THEN 25
    ELSE 0
  END;

  IF v_amount = 0 THEN
    RETURN 0;
  END IF;

  -- Ensure balance row exists
  PERFORM ensure_credits_balance(p_user_id);

  -- Insert reward (unique index prevents duplicates for non-repeatable rewards)
  BEGIN
    INSERT INTO reward_history (user_id, reward_type, amount, claimed)
    VALUES (p_user_id, p_reward_type, v_amount, true);
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN 0; -- already claimed
  END;

  IF v_inserted THEN
    -- Credit the balance
    UPDATE credits_balance
    SET balance = balance + v_amount, updated_at = now()
    WHERE user_id = p_user_id;

    -- Log transaction
    INSERT INTO credit_transactions (user_id, amount, type, description, status)
    VALUES (p_user_id, v_amount, 'earn', 'Nagrada: ' || p_reward_type, 'completed');

    RETURN v_amount;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: send_credits
-- Sends demo credits from one user to another.
-- Applies 15% platform fee.
-- Inserts notification for receiver.
-- ============================================================
CREATE OR REPLACE FUNCTION send_credits(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer
)
RETURNS jsonb AS $$
DECLARE
  v_sender_balance  integer;
  v_receiver_premium boolean;
  v_fee             integer;
  v_net             integer;
  v_sender_name     text;
BEGIN
  -- Validate amount
  IF p_amount NOT IN (5, 10, 20) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Check receiver is Creator Premium
  SELECT is_creator_premium INTO v_receiver_premium
  FROM profiles WHERE id = p_receiver_id;

  IF NOT COALESCE(v_receiver_premium, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receiver_not_creator_premium');
  END IF;

  -- Ensure balance rows exist
  PERFORM ensure_credits_balance(p_sender_id);
  PERFORM ensure_credits_balance(p_receiver_id);

  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM credits_balance WHERE user_id = p_sender_id;

  IF v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  -- Calculate fee (15%, minimum 1)
  v_fee := GREATEST(1, ROUND(p_amount * 0.15));
  v_net := p_amount - v_fee;

  -- Deduct from sender
  UPDATE credits_balance
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_sender_id;

  -- Credit receiver (net amount)
  UPDATE credits_balance
  SET balance = balance + v_net, updated_at = now()
  WHERE user_id = p_receiver_id;

  -- Get sender name for notification
  SELECT name INTO v_sender_name FROM profiles WHERE id = p_sender_id;

  -- Log sender transaction (spend)
  INSERT INTO credit_transactions
    (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status)
  VALUES
    (p_sender_id, p_sender_id, p_receiver_id, -p_amount, v_fee, 'spend',
     'Podrška poslata', 'completed');

  -- Log receiver transaction (earn)
  INSERT INTO credit_transactions
    (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status)
  VALUES
    (p_receiver_id, p_sender_id, p_receiver_id, v_net, v_fee, 'support',
     'Primljena podrška', 'completed');

  -- Notify receiver
  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    p_receiver_id,
    'credit',
    'credit_received',
    COALESCE(v_sender_name, 'Neko') || ' vam je poslao ' || p_amount || ' kredita',
    'Demo GigZone krediti • ' || v_net || ' kredita dodato na vaš balans',
    jsonb_build_object(
      'sender_id', p_sender_id,
      'amount',    p_amount,
      'net',       v_net,
      'fee',       v_fee
    )
  );

  RETURN jsonb_build_object(
    'ok',  true,
    'fee', v_fee,
    'net', v_net
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Registration reward (+10 credits)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Small delay guard: only run if profile has user_id set
  IF NEW.id IS NOT NULL THEN
    PERFORM earn_reward(NEW.id, 'registration');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_user_credits ON profiles;
CREATE TRIGGER trigger_new_user_credits
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();
