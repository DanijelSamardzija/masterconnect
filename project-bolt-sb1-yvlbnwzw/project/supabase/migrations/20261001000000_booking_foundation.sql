-- ==========================================================================
-- F0: Universal Booking Foundation — Schema Migration
-- All existing functionality remains UNCHANGED (additive only).
-- Zero new RPCs in this file — those come in F1 (Availability) and F2 (Booking).
-- DB runs in UTC. business_locations.timezone stores IANA name for local conversion.
-- Advisory lock prefix for booking RPCs: 'bk:s:' (staff), 'bk:r:' (resource),
-- 'bk:b:' (booking update), 'bk:si:' (invitation accept) — added in F2/F3.
-- B-4 locked: staff lock FIRST, resource lock SECOND to prevent deadlock.
-- ==========================================================================

-- ── Step 1: ALTER TABLE profiles ──────────────────────────────────────────
-- live_status is SEPARATE from profiles.availability (which is free-text for
-- matchmaking AI). live_status is structured for booking/live-match status.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_business  BOOL    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS latitude      FLOAT8,
  ADD COLUMN IF NOT EXISTS longitude     FLOAT8,
  ADD COLUMN IF NOT EXISTS live_status   TEXT    NOT NULL DEFAULT 'by_schedule'
    CHECK (live_status IN ('available_now', 'available_today', 'by_schedule', 'unavailable'));

-- ── Step 2: CREATE TABLE business_locations ───────────────────────────────
-- One row per physical location. is_primary = true for the main/only location.
-- timezone: IANA name (e.g. 'Europe/Sarajevo'). Used by slot generation to
-- convert opening_hours (local time) to UTC for booking comparisons.
-- lat/lng denormalized here (authoritative per location) AND on profiles
-- (convenience copy of primary location, for AI matching distance scoring).
CREATE TABLE IF NOT EXISTS public.business_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'Europe/Sarajevo',
  latitude    FLOAT8,
  longitude   FLOAT8,
  phone       TEXT,
  email       TEXT,
  is_primary  BOOL NOT NULL DEFAULT false,
  is_active   BOOL NOT NULL DEFAULT true,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 3: CREATE TABLE staff_members ───────────────────────────────────
-- Every worker/manager must have a GigZone account (user_id NOT NULL).
-- ON DELETE CASCADE: if a profile is deleted, their staff membership is removed.
-- bookings.staff_member_id uses ON DELETE SET NULL to preserve booking history.
CREATE TABLE IF NOT EXISTS public.staff_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'worker'
    CHECK (role IN ('owner', 'manager', 'worker')),
  primary_location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  is_active           BOOL NOT NULL DEFAULT true,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- ── Helper function (SECURITY DEFINER) ────────────────────────────────────
-- Created AFTER staff_members so the SQL body validates correctly.
-- Used by RLS policies on multiple tables to look up which businesses
-- the current user belongs to, bypassing RLS on staff_members for the
-- inner query (avoids infinite recursion in policy chains).
CREATE OR REPLACE FUNCTION public.get_my_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT business_id
  FROM staff_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- ── Step 4: CREATE TABLE staff_invitations ───────────────────────────────
-- Invitation flow (F3): owner sends email with token, recipient accepts via RPC.
-- Token acceptance is SECURITY DEFINER RPC (no SELECT policy needed for anon).
-- Owners cannot invite other owners (role IN ('manager','worker') only).
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'worker'
    CHECK (role IN ('manager', 'worker')),
  location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 5: CREATE TABLE service_catalog ─────────────────────────────────
-- Universal catalog: one row per bookable service, regardless of business type.
-- capacity = max concurrent bookings for this service (e.g. yoga class = 20).
-- buffer_minutes = buffer after service ends before next slot is available.
-- duration_minutes + buffer_minutes used by slot generation in F1.
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_type     TEXT NOT NULL DEFAULT 'appointment_service'
    CHECK (booking_type IN (
      'appointment_service', 'tradespeople', 'restaurant',
      'accommodation', 'order', 'event'
    )),
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  price            NUMERIC(10,2),
  price_type       TEXT NOT NULL DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'from', 'negotiable', 'free')),
  capacity         INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  is_active        BOOL NOT NULL DEFAULT true,
  meta             JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 6: CREATE TABLE resources ───────────────────────────────────────
-- Physical resources that can be booked: tables, rooms, seats, vehicles.
-- Placeholder for capacity monetization (business_plan_configs, all inactive).
CREATE TABLE IF NOT EXISTS public.resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id   UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('table', 'room', 'seat', 'vehicle', 'equipment', 'other')),
  name          TEXT NOT NULL,
  description   TEXT,
  capacity      INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  is_active     BOOL NOT NULL DEFAULT true,
  meta          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 7: CREATE TABLE opening_hours ───────────────────────────────────
-- Stores local time (not UTC). Slot generation RPC converts using location.timezone.
-- entity_type='business': location-level hours (staff_member_id IS NULL).
-- entity_type='staff': individual staff schedule (staff_member_id IS NOT NULL).
-- crosses_midnight=true: end_time < start_time, service runs into next calendar day.
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday (PostgreSQL EXTRACT(dow) convention).
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('business', 'staff')),
  location_id      UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  staff_member_id  UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  is_closed        BOOL NOT NULL DEFAULT false,
  crosses_midnight BOOL NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT opening_hours_entity_check CHECK (
    (entity_type = 'business' AND staff_member_id IS NULL)
    OR
    (entity_type = 'staff' AND staff_member_id IS NOT NULL)
  )
);

-- ── Step 8: CREATE TABLE time_blocks ─────────────────────────────────────
-- Ad-hoc unavailability: holidays, vacation, manual blocks, breaks.
-- Checked by slot generation to exclude these periods from available slots.
-- exactly one of (location_id / staff_member_id / resource_id) is NOT NULL,
-- enforced by the check constraint matching entity_type.
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('business', 'staff', 'resource')),
  location_id     UUID REFERENCES public.business_locations(id) ON DELETE CASCADE,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  resource_id     UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  reason          TEXT NOT NULL DEFAULT 'blocked'
    CHECK (reason IN ('holiday', 'vacation', 'blocked', 'break')),
  note            TEXT,
  is_recurring    BOOL NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT time_blocks_entity_check CHECK (
    (entity_type = 'business'  AND location_id IS NOT NULL     AND staff_member_id IS NULL AND resource_id IS NULL)
    OR
    (entity_type = 'staff'     AND staff_member_id IS NOT NULL AND location_id IS NULL     AND resource_id IS NULL)
    OR
    (entity_type = 'resource'  AND resource_id IS NOT NULL     AND location_id IS NULL     AND staff_member_id IS NULL)
  )
);

-- ── Step 9: CREATE TABLE booking_rules ───────────────────────────────────
-- One row per business (business_id IS PRIMARY KEY). Snapshot into bookings at
-- booking creation time (confirmation_mode snapshot stored on bookings row).
-- max_advance_days: locked at 60 (architectural decision).
-- slot_interval_min: determines granularity of available slot generation.
CREATE TABLE IF NOT EXISTS public.booking_rules (
  business_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirmation_mode  TEXT NOT NULL DEFAULT 'instant'
    CHECK (confirmation_mode IN ('instant', 'requires_approval')),
  min_notice_minutes INTEGER NOT NULL DEFAULT 60  CHECK (min_notice_minutes >= 0),
  max_advance_days   INTEGER NOT NULL DEFAULT 60  CHECK (max_advance_days BETWEEN 1 AND 60),
  cancellation_hours INTEGER NOT NULL DEFAULT 24  CHECK (cancellation_hours >= 0),
  slot_interval_min  INTEGER NOT NULL DEFAULT 15  CHECK (slot_interval_min IN (10, 15, 20, 30, 45, 60, 90, 120)),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 10: CREATE TABLE bookings ───────────────────────────────────────
-- Central booking record. Created ONLY via SECURITY DEFINER RPC (F2) with
-- advisory lock to prevent double-booking race conditions.
-- Advisory lock pattern (F2): staff FIRST, resource SECOND (B-4 locked).
-- Payment fields are present (payment-ready schema) but inactive until Stripe (future).
-- Snapshot fields (_snapshot) preserve service details at booking time, immune to
-- subsequent catalog changes.
CREATE TABLE IF NOT EXISTS public.bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type and parties
  booking_type          TEXT NOT NULL
    CHECK (booking_type IN (
      'appointment_service', 'tradespeople', 'restaurant',
      'accommodation', 'order', 'event'
    )),
  business_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  client_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- What was booked (service snapshot for history integrity)
  service_id            UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  service_name_snapshot TEXT,
  duration_minutes      INTEGER NOT NULL CHECK (duration_minutes > 0),

  -- Who performs and where
  staff_member_id       UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  location_id           UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  resource_id           UUID REFERENCES public.resources(id) ON DELETE SET NULL,

  -- When (UTC)
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,

  -- Booking details
  party_size            INTEGER NOT NULL DEFAULT 1 CHECK (party_size > 0),
  notes                 TEXT,
  internal_notes        TEXT,

  -- Status
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  confirmation_mode     TEXT NOT NULL DEFAULT 'instant'
    CHECK (confirmation_mode IN ('instant', 'requires_approval')),

  -- Cancellation tracking
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancellation_reason   TEXT,

  -- Payment-ready (NOT ACTIVE — all NULL until Stripe phase)
  total_amount          NUMERIC(10,2),
  deposit_amount        NUMERIC(10,2),
  payment_status        TEXT NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN (
      'not_required', 'pending', 'paid', 'refunded', 'partially_refunded'
    )),
  currency              TEXT DEFAULT 'EUR',

  -- Reminders
  reminder_sent_at      TIMESTAMPTZ,

  -- Extensible
  meta                  JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bookings_ends_after_starts CHECK (ends_at > starts_at)
);

-- ── Step 11: CREATE TABLE business_plan_configs ───────────────────────────
-- Monetization lookup table. ALL rows MUST have is_active = false until the
-- monetization phase is explicitly activated. Never set is_active=true manually.
-- Seeds placeholder rows after table creation (below, after RLS is set up).
CREATE TABLE IF NOT EXISTS public.business_plan_configs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type        TEXT NOT NULL,
  resource_type        TEXT NOT NULL,
  included_count       INTEGER NOT NULL DEFAULT 1 CHECK (included_count >= 0),
  price_per_additional NUMERIC(10,2),
  currency             TEXT NOT NULL DEFAULT 'EUR',
  billing_period       TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'yearly')),
  is_active            BOOL NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_type, resource_type, billing_period)
);

-- ── Step 12: ALTER TABLE reviews ──────────────────────────────────────────
-- Nullable FK: existing reviews are unaffected. booking_id set when a review
-- comes from a completed booking (F2). ON DELETE SET NULL preserves review
-- if booking is deleted.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS booking_id UUID
    REFERENCES public.bookings(id) ON DELETE SET NULL;

-- ── Step 13: ALTER TABLE posts ────────────────────────────────────────────
-- booking_enabled: allow booking directly from this post (F7).
-- business_id: which business profile this post belongs to (for slot lookup).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS booking_enabled BOOL NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_id     UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Step 14: ENABLE ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE public.business_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_hours         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_configs ENABLE ROW LEVEL SECURITY;

-- ── Step 15: RLS POLICIES ─────────────────────────────────────────────────
-- Pattern: service_role gets ALL (full bypass). Authenticated gets scoped SELECT.
-- All INSERT/UPDATE/DELETE for authenticated goes through SECURITY DEFINER RPCs
-- (F1/F2/F3) — no direct write policies needed here for Phase 1.

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ business_locations                                                        │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on business_locations"
  ON public.business_locations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public view active locations"
  ON public.business_locations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff view all locations of their business"
  ON public.business_locations FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_my_business_ids()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ staff_members                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on staff_members"
  ON public.staff_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users see their own membership. Colleagues are visible via get_my_business_ids()
-- which is SECURITY DEFINER — no recursion risk.
CREATE POLICY "Users view own staff membership"
  ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff view colleagues in same business"
  ON public.staff_members FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_my_business_ids()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ staff_invitations                                                         │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on staff_invitations"
  ON public.staff_invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Owners/managers see their own business's invitations.
-- Token-based acceptance (for invitees) goes through SECURITY DEFINER RPC (F3).
CREATE POLICY "Owners and managers view business invitations"
  ON public.staff_invitations FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT sm.business_id FROM public.staff_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
        AND sm.is_active = true
    )
  );

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ service_catalog                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on service_catalog"
  ON public.service_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public view active services"
  ON public.service_catalog FOR SELECT
  USING (is_active = true);

CREATE POLICY "Business staff view all their services"
  ON public.service_catalog FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_my_business_ids()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ resources                                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on resources"
  ON public.resources FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated view active resources"
  ON public.resources FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Business staff view all their resources"
  ON public.resources FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_my_business_ids()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ opening_hours                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on opening_hours"
  ON public.opening_hours FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Public read needed: anonymous users can check a business's availability
-- before creating an account (booking flow landing pages).
CREATE POLICY "Public read opening hours"
  ON public.opening_hours FOR SELECT
  USING (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ time_blocks                                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on time_blocks"
  ON public.time_blocks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public read time blocks"
  ON public.time_blocks FOR SELECT
  USING (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ booking_rules                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on booking_rules"
  ON public.booking_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public read booking rules"
  ON public.booking_rules FOR SELECT
  USING (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ bookings                                                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on bookings"
  ON public.bookings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Client sees their own bookings
CREATE POLICY "Client views own bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Staff sees bookings assigned to them (subquery on staff_members is safe:
-- staff_members RLS allows user_id=auth.uid() SELECT without recursion).
CREATE POLICY "Staff views their assigned bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    staff_member_id IN (
      SELECT id FROM public.staff_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Business owners/managers see all bookings for their business
CREATE POLICY "Business staff views all business bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_my_business_ids()));

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ business_plan_configs                                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE POLICY "service_role full access on business_plan_configs"
  ON public.business_plan_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read plan configs"
  ON public.business_plan_configs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── Step 16: GRANT statements ─────────────────────────────────────────────
GRANT ALL ON public.business_locations    TO service_role;
GRANT ALL ON public.staff_members         TO service_role;
GRANT ALL ON public.staff_invitations     TO service_role;
GRANT ALL ON public.service_catalog       TO service_role;
GRANT ALL ON public.resources             TO service_role;
GRANT ALL ON public.opening_hours         TO service_role;
GRANT ALL ON public.time_blocks           TO service_role;
GRANT ALL ON public.booking_rules         TO service_role;
GRANT ALL ON public.bookings              TO service_role;
GRANT ALL ON public.business_plan_configs TO service_role;

-- Public/anon SELECT on tables needed for booking flow before login
GRANT SELECT ON public.business_locations TO authenticated, anon;
GRANT SELECT ON public.service_catalog    TO authenticated, anon;
GRANT SELECT ON public.opening_hours      TO authenticated, anon;
GRANT SELECT ON public.time_blocks        TO authenticated, anon;
GRANT SELECT ON public.booking_rules      TO authenticated, anon;

-- Authenticated-only SELECT (requires login)
GRANT SELECT ON public.staff_members         TO authenticated;
GRANT SELECT ON public.staff_invitations     TO authenticated;
GRANT SELECT ON public.resources             TO authenticated;
GRANT SELECT ON public.bookings              TO authenticated;
GRANT SELECT ON public.business_plan_configs TO authenticated;

-- ── Step 17: INDEXES ─────────────────────────────────────────────────────

-- business_locations
CREATE INDEX IF NOT EXISTS idx_biz_locations_business_id
  ON public.business_locations(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_locations_active
  ON public.business_locations(business_id, is_active) WHERE is_active = true;

-- staff_members
CREATE INDEX IF NOT EXISTS idx_staff_members_user_id
  ON public.staff_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_business_id
  ON public.staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_business_user
  ON public.staff_members(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_active
  ON public.staff_members(business_id, is_active) WHERE is_active = true;

-- staff_invitations
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token
  ON public.staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email_status
  ON public.staff_invitations(email, status);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_business_id
  ON public.staff_invitations(business_id);

-- service_catalog
CREATE INDEX IF NOT EXISTS idx_service_catalog_business_id
  ON public.service_catalog(business_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_active
  ON public.service_catalog(business_id, is_active) WHERE is_active = true;

-- resources
CREATE INDEX IF NOT EXISTS idx_resources_business_id
  ON public.resources(business_id);
CREATE INDEX IF NOT EXISTS idx_resources_location_id
  ON public.resources(location_id) WHERE location_id IS NOT NULL;

-- opening_hours
CREATE INDEX IF NOT EXISTS idx_opening_hours_location_day
  ON public.opening_hours(location_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_opening_hours_staff
  ON public.opening_hours(staff_member_id) WHERE staff_member_id IS NOT NULL;

-- time_blocks (no GIST — uses entity FKs instead)
CREATE INDEX IF NOT EXISTS idx_time_blocks_location
  ON public.time_blocks(location_id, starts_at, ends_at)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_staff
  ON public.time_blocks(staff_member_id, starts_at, ends_at)
  WHERE staff_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_resource
  ON public.time_blocks(resource_id, starts_at, ends_at)
  WHERE resource_id IS NOT NULL;

-- bookings (most critical indexes — used by slot generation and calendar views)
CREATE INDEX IF NOT EXISTS idx_bookings_business_starts
  ON public.bookings(business_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_client_starts
  ON public.bookings(client_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_starts
  ON public.bookings(staff_member_id, starts_at)
  WHERE staff_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_location_starts
  ON public.bookings(location_id, starts_at)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_resource_starts
  ON public.bookings(resource_id, starts_at)
  WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_status_starts
  ON public.bookings(status, starts_at);

-- reviews new column
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id
  ON public.reviews(booking_id) WHERE booking_id IS NOT NULL;

-- posts new columns
CREATE INDEX IF NOT EXISTS idx_posts_business_id
  ON public.posts(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_booking_enabled
  ON public.posts(booking_enabled) WHERE booking_enabled = true;

-- ── Step 18: Seed business_plan_configs (all inactive) ────────────────────
-- Placeholder monetization config. is_active=false on ALL rows.
-- These are NEVER activated manually — only via a dedicated admin RPC (future).
INSERT INTO public.business_plan_configs
  (business_type, resource_type, included_count, price_per_additional, billing_period, is_active)
VALUES
  ('salon',       'worker',   1, 9.99,  'monthly', false),
  ('restaurant',  'resource', 4, 4.99,  'monthly', false),
  ('hotel',       'location', 1, 29.99, 'monthly', false),
  ('clinic',      'worker',   1, 14.99, 'monthly', false),
  ('fitness',     'resource', 1, 7.99,  'monthly', false),
  ('generic',     'worker',   1, 9.99,  'monthly', false)
ON CONFLICT (business_type, resource_type, billing_period) DO NOTHING;
