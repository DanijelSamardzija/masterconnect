-- ============================================================
-- Investment Waitlist
-- ============================================================

CREATE TABLE IF NOT EXISTS investment_waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  role       text NOT NULL
               CHECK (role IN ('investor', 'business_owner', 'startup_founder', 'service_business')),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investment_waitlist_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_investment_waitlist_email      ON investment_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_investment_waitlist_role       ON investment_waitlist(role);
CREATE INDEX IF NOT EXISTS idx_investment_waitlist_created_at ON investment_waitlist(created_at DESC);

ALTER TABLE investment_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_waitlist_public_insert" ON investment_waitlist;
CREATE POLICY "investment_waitlist_public_insert"
  ON investment_waitlist FOR INSERT
  WITH CHECK (true);
