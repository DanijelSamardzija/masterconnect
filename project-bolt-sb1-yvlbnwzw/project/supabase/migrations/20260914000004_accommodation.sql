-- Accommodation booking system (rooms, apartments, villas)
-- Structured for easy future payment integration (payment_status column)
-- Tables: accommodation_units, accommodation_photos, accommodation_bookings, accommodation_settings

CREATE TABLE IF NOT EXISTS public.accommodation_units (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT           NOT NULL,   -- "Soba 1", "Apartman Jezero", "Vila Bor"
  unit_type      TEXT           NOT NULL DEFAULT 'room',
  -- 'room' | 'apartment' | 'suite' | 'villa' | 'cabin' | 'studio'
  capacity       INTEGER        NOT NULL DEFAULT 2,
  price_per_night NUMERIC(10,2) NOT NULL,
  price_currency TEXT           NOT NULL DEFAULT 'BAM',
  description    TEXT,
  amenities      TEXT[],        -- ['WiFi', 'Klima', 'Parking', 'TV', 'Kuhinja', 'Balkon']
  is_active      BOOLEAN        NOT NULL DEFAULT true,
  sort_order     INTEGER        NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Photos per unit (multiple photos per room/apartment)
CREATE TABLE IF NOT EXISTS public.accommodation_photos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID        NOT NULL REFERENCES public.accommodation_units(id) ON DELETE CASCADE,
  business_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  caption     TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accommodation_bookings (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id        UUID           NOT NULL REFERENCES public.accommodation_units(id) ON DELETE CASCADE,
  client_id      UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name    TEXT,
  client_phone   TEXT,
  client_email   TEXT,
  check_in       DATE           NOT NULL,
  check_out      DATE           NOT NULL,
  guests         INTEGER        NOT NULL DEFAULT 1,
  total_amount   NUMERIC(10,2),  -- nights × price_per_night (computed at booking time)
  status         TEXT           NOT NULL DEFAULT 'pending',
  -- pending | confirmed | checked_in | checked_out | cancelled
  payment_status TEXT           NOT NULL DEFAULT 'unpaid',
  -- unpaid | deposit_paid | paid  ← ready for future payment integration
  notes          TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT chk_checkout_after_checkin CHECK (check_out > check_in)
);

-- Per-business settings for accommodation
CREATE TABLE IF NOT EXISTS public.accommodation_settings (
  business_id          UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in_time        TIME        NOT NULL DEFAULT '14:00',
  check_out_time       TIME        NOT NULL DEFAULT '11:00',
  min_nights           INTEGER     NOT NULL DEFAULT 1,
  max_nights           INTEGER,
  cancellation_hours   INTEGER     NOT NULL DEFAULT 48,
  breakfast_included   BOOLEAN     NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.accommodation_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_settings  ENABLE ROW LEVEL SECURITY;

-- Business manages their own units
CREATE POLICY "au_business_all"  ON public.accommodation_units    FOR ALL USING (business_id = auth.uid());
CREATE POLICY "au_public_select" ON public.accommodation_units    FOR SELECT USING (is_active = true);

-- Business manages their own photos
CREATE POLICY "ap_business_all"  ON public.accommodation_photos   FOR ALL USING (business_id = auth.uid());
CREATE POLICY "ap_public_select" ON public.accommodation_photos   FOR SELECT USING (true);

-- Business manages all bookings
CREATE POLICY "ab_business_all"  ON public.accommodation_bookings FOR ALL USING (business_id = auth.uid());
-- Client manages their own bookings
CREATE POLICY "ab_client_all"    ON public.accommodation_bookings FOR ALL USING (client_id = auth.uid());
-- Guest (unauthenticated) can INSERT a booking
CREATE POLICY "ab_public_insert" ON public.accommodation_bookings FOR INSERT WITH CHECK (true);

-- Business manages settings
CREATE POLICY "as_business_all"  ON public.accommodation_settings FOR ALL USING (business_id = auth.uid());
CREATE POLICY "as_public_select" ON public.accommodation_settings FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_au_business      ON public.accommodation_units(business_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ap_unit          ON public.accommodation_photos(unit_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ab_business      ON public.accommodation_bookings(business_id, check_in);
CREATE INDEX IF NOT EXISTS idx_ab_unit_dates    ON public.accommodation_bookings(unit_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_ab_client        ON public.accommodation_bookings(client_id);
