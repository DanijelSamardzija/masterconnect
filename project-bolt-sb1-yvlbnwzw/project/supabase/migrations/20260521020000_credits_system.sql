-- GigZone Credits & Premium Subscription System
-- Tables created now; payment logic and balances wired up in a future sprint.

-- Credits balance: one row per user, auto-created on first use
CREATE TABLE IF NOT EXISTS credits_balance (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Credit transactions ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       integer NOT NULL,
  type         text NOT NULL CHECK (type IN ('support', 'purchase', 'earn', 'spend', 'admin_grant', 'refund')),
  description  text,
  reference_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Premium subscriptions
CREATE TABLE IF NOT EXISTS premium_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan       text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly', 'yearly')),
  price      numeric(10,2) NOT NULL,
  currency   text NOT NULL DEFAULT 'EUR',
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add premium flag to profiles (account-level marker set by admin/system)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS premium_subscriptions_user_id_idx ON premium_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS premium_subscriptions_status_idx ON premium_subscriptions(status);

-- RLS
ALTER TABLE credits_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_subscriptions ENABLE ROW LEVEL SECURITY;

-- credits_balance policies
CREATE POLICY "Users view own balance"
  ON credits_balance FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all balances"
  ON credits_balance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- credit_transactions policies
CREATE POLICY "Users view own transactions"
  ON credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all transactions"
  ON credit_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- premium_subscriptions policies
CREATE POLICY "Users view own subscription"
  ON premium_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all subscriptions"
  ON premium_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Service role full access (used by backend functions)
GRANT ALL ON credits_balance TO service_role;
GRANT ALL ON credit_transactions TO service_role;
GRANT ALL ON premium_subscriptions TO service_role;
