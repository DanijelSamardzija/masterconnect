-- ==========================================================================
-- Migration 1 of 6: booking_profiles table
-- Introduces booking_profiles as a separate identity for booking entities,
-- decoupling them from profiles so one user can own multiple booking profiles.
--
-- SAFE: additive only. No existing data is modified.
-- FK rebind (Migration 2), RLS updates (Migration 3), and RPC changes
-- (Migration 4) are intentionally deferred to separate migrations.
--
-- KEY INSIGHT: existing business users get a booking_profiles row with the
-- SAME UUID as their profiles.id. All existing business_id foreign key values
-- in bookings, service_catalog, business_locations etc. stay identical —
-- they just point to a new table after Migration 2. Until Migration 2 runs,
-- all existing FK constraints remain on profiles(id) and nothing breaks.
-- ==========================================================================

BEGIN;

-- ── Step 1: Create booking_profiles ───────────────────────────────────────
-- profile_type values mirror existing booking_category values on profiles
-- to allow a direct COALESCE copy during population below.
CREATE TABLE IF NOT EXISTS public.booking_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_type TEXT        NOT NULL DEFAULT 'appointment'
                           CHECK (profile_type IN (
                             'appointment',
                             'accommodation',
                             'restaurant',
                             'tradespeople',
                             'food_order'
                           )),
  name         TEXT        NOT NULL,
  avatar_url   TEXT,
  is_active    BOOL        NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 2: Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_profiles_owner
  ON public.booking_profiles(owner_id);

CREATE INDEX IF NOT EXISTS idx_booking_profiles_owner_active
  ON public.booking_profiles(owner_id, is_active);

-- ── Step 3: Row-Level Security ─────────────────────────────────────────────
ALTER TABLE public.booking_profiles ENABLE ROW LEVEL SECURITY;

-- Owner sees and manages all their own profiles (active and inactive).
CREATE POLICY bp_owner_all ON public.booking_profiles
  FOR ALL
  TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Public (anon + authenticated) can read active profiles —
-- required for /booking/{id} public page to resolve the business name/type.
CREATE POLICY bp_public_read ON public.booking_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── Step 4: Populate from existing business profiles (SAME UUID) ──────────
-- For every profiles row with is_business = true, insert a booking_profiles
-- row reusing the exact same UUID. This means:
--   profiles.id == booking_profiles.id == all existing business_id values
-- No UUID changes anywhere. All existing reservations, services, and
-- locations will point to the correct booking_profiles row after Migration 2
-- changes the FK targets.
--
-- booking_category values map directly to profile_type (same string values).
-- If booking_category is NULL, we default to 'appointment'.
INSERT INTO public.booking_profiles (id, owner_id, profile_type, name, is_active)
SELECT
  p.id,
  p.id,
  COALESCE(
    CASE p.booking_category
      WHEN 'appointment'    THEN 'appointment'
      WHEN 'accommodation'  THEN 'accommodation'
      WHEN 'restaurant'     THEN 'restaurant'
      WHEN 'tradespeople'   THEN 'tradespeople'
      WHEN 'food_order'     THEN 'food_order'
      ELSE 'appointment'
    END,
    'appointment'
  ),
  COALESCE(p.name, 'Booking profil'),
  COALESCE(p.is_business, false)
FROM public.profiles p
WHERE p.is_business = true
ON CONFLICT (id) DO NOTHING;

COMMIT;
