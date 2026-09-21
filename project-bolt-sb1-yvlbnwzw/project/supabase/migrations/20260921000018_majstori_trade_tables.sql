-- Faza 1 (Majstori i Firme): Create core trade tables.
--
-- All tables use business_id → booking_profiles(id) (not profiles(id)).
-- RLS follows the get_my_business_ids() pattern established in migration 003.
-- purchase_price is hidden at the APP/RPC layer for staff without
-- can_view_purchase_prices; column-level security is not available in PG RLS.

-- ─────────────────────────────────────────────
-- 1. trade_clients — client record cards
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  phone        TEXT,
  whatsapp     TEXT,
  viber        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_clients_business_id_idx ON trade_clients (business_id);

ALTER TABLE trade_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_clients_staff_all ON trade_clients
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ─────────────────────────────────────────────
-- 2. trade_assets — client assets / objects
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_assets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  client_id    UUID        REFERENCES trade_clients(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  asset_type   TEXT,   -- 'property' | 'vehicle' | 'equipment' | 'appliance' | etc.
  description  TEXT,
  location     TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_assets_business_id_idx ON trade_assets (business_id);
CREATE INDEX IF NOT EXISTS trade_assets_client_id_idx  ON trade_assets (client_id);

ALTER TABLE trade_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_assets_staff_all ON trade_assets
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ─────────────────────────────────────────────
-- 3. trade_jobs — central Work Order
--    Not slot-based; can span multiple days.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_jobs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID         NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  client_id            UUID         REFERENCES trade_clients(id)    ON DELETE SET NULL,
  asset_id             UUID         REFERENCES trade_assets(id)     ON DELETE SET NULL,
  service_id           UUID         REFERENCES tradesperson_services(id) ON DELETE SET NULL,

  -- origin links this job to its source document (booking, request, emergency)
  origin_type          TEXT         NOT NULL DEFAULT 'manual'
                         CHECK (origin_type IN ('manual', 'booking', 'request', 'emergency')),
  origin_id            UUID,   -- booking.id / tradesperson_requests.id / trade_emergency_requests.id

  assigned_to          UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  title                TEXT         NOT NULL,
  description          TEXT,
  status               TEXT         NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','on_hold')),
  priority             TEXT         NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low','normal','high','urgent')),

  scheduled_start      TIMESTAMPTZ,
  scheduled_end        TIMESTAMPTZ,
  actual_start         TIMESTAMPTZ,
  actual_end           TIMESTAMPTZ,

  location             TEXT,
  notes                TEXT,
  report_text          TEXT,   -- field worker's completion report

  total_labor_cost     NUMERIC(10,2),
  total_materials_cost NUMERIC(10,2),
  total_expenses       NUMERIC(10,2),
  invoice_amount       NUMERIC(10,2),
  is_invoiced          BOOLEAN      NOT NULL DEFAULT false,

  created_by           UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_jobs_business_id_idx      ON trade_jobs (business_id);
CREATE INDEX IF NOT EXISTS trade_jobs_client_id_idx        ON trade_jobs (client_id);
CREATE INDEX IF NOT EXISTS trade_jobs_assigned_to_idx      ON trade_jobs (assigned_to);
CREATE INDEX IF NOT EXISTS trade_jobs_status_idx           ON trade_jobs (business_id, status);
CREATE INDEX IF NOT EXISTS trade_jobs_scheduled_start_idx  ON trade_jobs (business_id, scheduled_start);

ALTER TABLE trade_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_jobs_staff_all ON trade_jobs
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ─────────────────────────────────────────────
-- 4. trade_job_photos — before/during/after/doc
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_job_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID        NOT NULL REFERENCES trade_jobs(id)       ON DELETE CASCADE,
  business_id  UUID        NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  photo_type   TEXT        NOT NULL DEFAULT 'during'
                 CHECK (photo_type IN ('before','during','after','document')),
  storage_path TEXT        NOT NULL,
  caption      TEXT,
  uploaded_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_job_photos_job_id_idx      ON trade_job_photos (job_id);
CREATE INDEX IF NOT EXISTS trade_job_photos_business_id_idx ON trade_job_photos (business_id);

ALTER TABLE trade_job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_job_photos_staff_all ON trade_job_photos
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ─────────────────────────────────────────────
-- 5. trade_job_materials — material line items
--    purchase_price is NOT filtered by RLS;
--    RPCs return null for staff without can_view_purchase_prices.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_job_materials (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID         NOT NULL REFERENCES trade_jobs(id)       ON DELETE CASCADE,
  business_id    UUID         NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,
  quantity       NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit           TEXT,
  purchase_price NUMERIC(10,2),   -- hidden at app level for workers without permission
  sale_price     NUMERIC(10,2),
  supplier       TEXT,
  notes          TEXT,
  added_by       UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_job_materials_job_id_idx      ON trade_job_materials (job_id);
CREATE INDEX IF NOT EXISTS trade_job_materials_business_id_idx ON trade_job_materials (business_id);

ALTER TABLE trade_job_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_job_materials_staff_all ON trade_job_materials
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ─────────────────────────────────────────────
-- 6. trade_job_expenses — job expense records
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_job_expenses (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID         NOT NULL REFERENCES trade_jobs(id)       ON DELETE CASCADE,
  business_id   UUID         NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  expense_type  TEXT         NOT NULL DEFAULT 'other'
                  CHECK (expense_type IN ('fuel','tool','subcontractor','parking','other')),
  description   TEXT         NOT NULL,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  receipt_path  TEXT,
  added_by      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_job_expenses_job_id_idx      ON trade_job_expenses (job_id);
CREATE INDEX IF NOT EXISTS trade_job_expenses_business_id_idx ON trade_job_expenses (business_id);

ALTER TABLE trade_job_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_job_expenses_staff_all ON trade_job_expenses
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));
