-- ============================================================
-- GigZone — Investment Tables Migration
-- Safe to run on existing production database (IF NOT EXISTS)
-- ============================================================

-- ── updated_at trigger function (reusable) ──────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. investment_projects
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_projects (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  description             text,
  category                text,
  city                    text,
  country                 text,
  funding_goal            numeric CHECK (funding_goal > 0),
  amount_raised           numeric NOT NULL DEFAULT 0 CHECK (amount_raised >= 0),
  minimum_investment      numeric CHECK (minimum_investment > 0),
  maximum_investment      numeric CHECK (maximum_investment > 0),
  funding_deadline        timestamptz,
  expected_return         text,
  estimated_roi           text,
  risk_level              text CHECK (risk_level IN ('Low', 'Medium', 'High')),
  status                  text NOT NULL DEFAULT 'coming_soon'
                            CHECK (status IN ('coming_soon', 'preview', 'under_review', 'active', 'funded', 'closed', 'rejected')),
  verification_status     text NOT NULL DEFAULT 'unverified'
                            CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  is_verified             boolean NOT NULL DEFAULT false,
  verified_at             timestamptz,
  image_url               text,
  escrow_status           text NOT NULL DEFAULT 'disabled'
                            CHECK (escrow_status IN ('disabled', 'pending', 'active', 'released')),
  accepted_risk_terms     boolean NOT NULL DEFAULT false,
  is_hidden               boolean NOT NULL DEFAULT false,
  rejection_reason        text,
  suspended_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_investment_projects_user_id    ON investment_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_projects_category   ON investment_projects(category);
CREATE INDEX IF NOT EXISTS idx_investment_projects_status     ON investment_projects(status);
CREATE INDEX IF NOT EXISTS idx_investment_projects_is_hidden  ON investment_projects(is_hidden);
CREATE INDEX IF NOT EXISTS idx_investment_projects_created_at ON investment_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investment_projects_country    ON investment_projects(country);
CREATE INDEX IF NOT EXISTS idx_investment_projects_city       ON investment_projects(city);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_investment_projects_updated_at ON investment_projects;
CREATE TRIGGER trg_investment_projects_updated_at
  BEFORE UPDATE ON investment_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE investment_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_projects_public_read"   ON investment_projects;
DROP POLICY IF EXISTS "investment_projects_owner_read"    ON investment_projects;
DROP POLICY IF EXISTS "investment_projects_owner_insert"  ON investment_projects;
DROP POLICY IF EXISTS "investment_projects_owner_update"  ON investment_projects;
DROP POLICY IF EXISTS "investment_projects_owner_delete"  ON investment_projects;

CREATE POLICY "investment_projects_public_read"
  ON investment_projects FOR SELECT
  USING (is_hidden = false);

CREATE POLICY "investment_projects_owner_read"
  ON investment_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "investment_projects_owner_insert"
  ON investment_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "investment_projects_owner_update"
  ON investment_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "investment_projects_owner_delete"
  ON investment_projects FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- 2. investment_interests
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_interests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     text,
  amount      numeric CHECK (amount > 0),
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investment_interests_unique UNIQUE (project_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_investment_interests_project_id  ON investment_interests(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_interests_investor_id ON investment_interests(investor_id);
CREATE INDEX IF NOT EXISTS idx_investment_interests_status      ON investment_interests(status);

DROP TRIGGER IF EXISTS trg_investment_interests_updated_at ON investment_interests;
CREATE TRIGGER trg_investment_interests_updated_at
  BEFORE UPDATE ON investment_interests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE investment_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_interests_investor_all"          ON investment_interests;
DROP POLICY IF EXISTS "investment_interests_project_owner_read"    ON investment_interests;

CREATE POLICY "investment_interests_investor_all"
  ON investment_interests FOR ALL
  USING (auth.uid() = investor_id)
  WITH CHECK (auth.uid() = investor_id);

CREATE POLICY "investment_interests_project_owner_read"
  ON investment_interests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_interests.project_id
        AND user_id = auth.uid()
    )
  );


-- ============================================================
-- 3. investment_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  file_url      text NOT NULL,
  file_name     text NOT NULL,
  document_type text CHECK (document_type IN ('business_plan', 'financial_report', 'legal', 'pitch_deck', 'other')),
  is_public     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_documents_project_id ON investment_documents(project_id);

ALTER TABLE investment_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_documents_public_read" ON investment_documents;
DROP POLICY IF EXISTS "investment_documents_owner_all"   ON investment_documents;

CREATE POLICY "investment_documents_public_read"
  ON investment_documents FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_documents.project_id AND is_hidden = false
    )
  );

CREATE POLICY "investment_documents_owner_all"
  ON investment_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_documents.project_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_documents.project_id AND user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. saved_investment_projects
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_investment_projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saved_investment_projects_unique UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_investment_projects_user_id    ON saved_investment_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_investment_projects_project_id ON saved_investment_projects(project_id);

ALTER TABLE saved_investment_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_investment_projects_user_all" ON saved_investment_projects;

CREATE POLICY "saved_investment_projects_user_all"
  ON saved_investment_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 5. investment_project_updates
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_project_updates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    text NOT NULL,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_project_updates_project_id ON investment_project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_project_updates_created_at ON investment_project_updates(created_at DESC);

DROP TRIGGER IF EXISTS trg_investment_project_updates_updated_at ON investment_project_updates;
CREATE TRIGGER trg_investment_project_updates_updated_at
  BEFORE UPDATE ON investment_project_updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE investment_project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_project_updates_public_read" ON investment_project_updates;
DROP POLICY IF EXISTS "investment_project_updates_owner_all"   ON investment_project_updates;

CREATE POLICY "investment_project_updates_public_read"
  ON investment_project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_project_updates.project_id AND is_hidden = false
    )
  );

CREATE POLICY "investment_project_updates_owner_all"
  ON investment_project_updates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 6. investment_project_faqs
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_project_faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  question   text NOT NULL,
  answer     text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_project_faqs_project_id ON investment_project_faqs(project_id);

DROP TRIGGER IF EXISTS trg_investment_project_faqs_updated_at ON investment_project_faqs;
CREATE TRIGGER trg_investment_project_faqs_updated_at
  BEFORE UPDATE ON investment_project_faqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE investment_project_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_project_faqs_public_read" ON investment_project_faqs;
DROP POLICY IF EXISTS "investment_project_faqs_owner_all"   ON investment_project_faqs;

CREATE POLICY "investment_project_faqs_public_read"
  ON investment_project_faqs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_project_faqs.project_id AND is_hidden = false
    )
  );

CREATE POLICY "investment_project_faqs_owner_all"
  ON investment_project_faqs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_project_faqs.project_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investment_projects
      WHERE id = investment_project_faqs.project_id AND user_id = auth.uid()
    )
  );


-- ============================================================
-- 7. investment_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS investment_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES investment_projects(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investment_reports_unique UNIQUE (project_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_investment_reports_project_id  ON investment_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_reports_reporter_id ON investment_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_investment_reports_status      ON investment_reports(status);

DROP TRIGGER IF EXISTS trg_investment_reports_updated_at ON investment_reports;
CREATE TRIGGER trg_investment_reports_updated_at
  BEFORE UPDATE ON investment_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE investment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_reports_reporter_insert" ON investment_reports;
DROP POLICY IF EXISTS "investment_reports_reporter_read"   ON investment_reports;

CREATE POLICY "investment_reports_reporter_insert"
  ON investment_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "investment_reports_reporter_read"
  ON investment_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ============================================================
-- Done.
-- ============================================================
