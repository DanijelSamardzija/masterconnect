-- Restaurant table reservation system
-- Tables: restaurant_tables, table_reservations

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  capacity      INTEGER     NOT NULL DEFAULT 4,
  location_tag  TEXT,       -- 'indoor', 'outdoor', 'terrace', 'bar'
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_reservations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  table_id         UUID        REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  client_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name      TEXT,
  client_phone     TEXT,
  client_email     TEXT,
  party_size       INTEGER     NOT NULL,
  reserved_date    DATE        NOT NULL,
  reserved_time    TIME        NOT NULL,
  duration_minutes INTEGER     NOT NULL DEFAULT 90,
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- pending | confirmed | seated | completed | cancelled | no_show
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.restaurant_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_reservations     ENABLE ROW LEVEL SECURITY;

-- Business owns their tables
CREATE POLICY "rt_business_all" ON public.restaurant_tables
  FOR ALL USING (business_id = auth.uid());

-- Anyone can read active tables (needed for booking form)
CREATE POLICY "rt_public_select" ON public.restaurant_tables
  FOR SELECT USING (is_active = true);

-- Business manages all reservations
CREATE POLICY "tr_business_all" ON public.table_reservations
  FOR ALL USING (business_id = auth.uid());

-- Client sees / manages their own reservations
CREATE POLICY "tr_client_all" ON public.table_reservations
  FOR ALL USING (client_id = auth.uid());

-- Guest (unauthenticated) can INSERT a reservation
CREATE POLICY "tr_public_insert" ON public.table_reservations
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rt_business   ON public.restaurant_tables(business_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tr_business   ON public.table_reservations(business_id, reserved_date);
CREATE INDEX IF NOT EXISTS idx_tr_date_table ON public.table_reservations(table_id, reserved_date);
CREATE INDEX IF NOT EXISTS idx_tr_client     ON public.table_reservations(client_id);
