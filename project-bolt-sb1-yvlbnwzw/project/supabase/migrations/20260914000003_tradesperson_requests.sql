-- Tradesperson / craftsman system
-- Flow: client submits request → tradesperson sends quote → client accepts → work scheduled
-- Tables: tradesperson_services, tradesperson_requests, tradesperson_quotes

CREATE TABLE IF NOT EXISTS public.tradesperson_services (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT           NOT NULL,   -- "Popravka slavine", "Elektro instalacije"
  description    TEXT,
  price_type     TEXT           NOT NULL DEFAULT 'quote', -- 'fixed' | 'hourly' | 'quote'
  price_from     NUMERIC(10,2), -- starting price (optional)
  price_currency TEXT           NOT NULL DEFAULT 'BAM',
  is_active      BOOLEAN        NOT NULL DEFAULT true,
  sort_order     INTEGER        NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tradesperson_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id           UUID        REFERENCES public.tradesperson_services(id) ON DELETE SET NULL,
  client_id            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name          TEXT,
  client_phone         TEXT,
  title                TEXT        NOT NULL,
  description          TEXT        NOT NULL,
  address              TEXT,
  city                 TEXT,
  preferred_date       DATE,
  preferred_time       TEXT,       -- 'morning' | 'afternoon' | 'evening' | 'flexible'
  photos               TEXT[],     -- array of image URLs
  status               TEXT        NOT NULL DEFAULT 'open',
  -- open | quoted | accepted | scheduled | in_progress | completed | cancelled | declined
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tradesperson_quotes (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID           NOT NULL REFERENCES public.tradesperson_requests(id) ON DELETE CASCADE,
  business_id    UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_amount   NUMERIC(10,2),
  price_type     TEXT           NOT NULL DEFAULT 'fixed', -- 'fixed' | 'hourly' | 'range'
  price_max      NUMERIC(10,2), -- used when price_type = 'range'
  price_currency TEXT           NOT NULL DEFAULT 'BAM',
  duration_estimate TEXT,       -- free text: "2–3 sata", "1 radni dan"
  scheduled_date DATE,
  scheduled_time TIME,
  message        TEXT,          -- explanation / notes from tradesperson
  status         TEXT           NOT NULL DEFAULT 'pending',
  -- pending | accepted | rejected
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tradesperson_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradesperson_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradesperson_quotes   ENABLE ROW LEVEL SECURITY;

-- Business manages own services
CREATE POLICY "ts_business_all"  ON public.tradesperson_services FOR ALL USING (business_id = auth.uid());
CREATE POLICY "ts_public_select" ON public.tradesperson_services FOR SELECT USING (is_active = true);

-- Business manages requests directed at them
CREATE POLICY "treq_business_all" ON public.tradesperson_requests FOR ALL USING (business_id = auth.uid());
-- Client manages their own requests
CREATE POLICY "treq_client_all"   ON public.tradesperson_requests FOR ALL USING (client_id = auth.uid());
-- Anyone can submit a request (guest)
CREATE POLICY "treq_public_insert" ON public.tradesperson_requests FOR INSERT WITH CHECK (true);

-- Business manages their own quotes
CREATE POLICY "tq_business_all" ON public.tradesperson_quotes FOR ALL USING (business_id = auth.uid());
-- Client can read quotes for their requests
CREATE POLICY "tq_client_select" ON public.tradesperson_quotes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tradesperson_requests r
    WHERE r.id = request_id AND r.client_id = auth.uid()
  )
);
-- Client can update quote status (accept/reject)
CREATE POLICY "tq_client_update" ON public.tradesperson_quotes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tradesperson_requests r
    WHERE r.id = request_id AND r.client_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ts_business    ON public.tradesperson_services(business_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_treq_business  ON public.tradesperson_requests(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treq_client    ON public.tradesperson_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_treq_service   ON public.tradesperson_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_tq_request     ON public.tradesperson_quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_tq_business    ON public.tradesperson_quotes(business_id, created_at DESC);
