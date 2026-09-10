-- ==========================================================================
-- F8: AI Live Matching for Booking
--   1. Indexes for fast live_status + is_business queries
--   2. set_business_live_status() RPC — staff sets their business live status
--   3. find_bookable_profiles()    RPC — discovery: who is bookable right now
-- ==========================================================================
--
-- Architecture decisions locked for F8:
--   • profiles.live_status  = structured enum, used here     (F8 scope)
--   • profiles.availability = free-text, used by AI matching (DO NOT TOUCH)
--   • find_matching_profiles() is NOT changed               (forward AI pipeline)
--   • find_bookable_profiles() is a SEPARATE new RPC
--
-- live_status semantics:
--   available_now   — business declares they can accept a booking within hours;
--                     find_bookable_profiles also confirms opening_hours covers
--                     the current moment (schedule agrees) or accepts declaration alone
--   available_today — business is open some time today (hours not started yet, or
--                     opening_hours has a window today that hasn't ended)
--   by_schedule     — no special live signal; slot availability via get_available_slots
--   unavailable     — explicitly off; excluded from all live results
-- ==========================================================================

-- ── Indexes (partial, IS_BUSINESS + live_status) ──────────────────────────
-- Supports fast WHERE is_business=true AND live_status IN (...) scans.
CREATE INDEX IF NOT EXISTS idx_profiles_is_biz_live
  ON public.profiles(is_business, live_status)
  WHERE is_business = true;

CREATE INDEX IF NOT EXISTS idx_profiles_live_active
  ON public.profiles(live_status)
  WHERE live_status IN ('available_now', 'available_today');

-- ── Helper: is a business open RIGHT NOW according to opening_hours ────────
-- Returns TRUE when:
--   • business has a 'business' opening_hours row for today's day_of_week
--   • is_closed = false
--   • current local time (in business timezone) falls within [start_time, end_time]
--   • no active time_block of type 'business' covers now() for the primary location
-- Used inside find_bookable_profiles; not exposed as a public RPC.
CREATE OR REPLACE FUNCTION private_biz_is_open_now(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc_id   UUID;
  v_tz       TEXT;
  v_now_local TIMESTAMPTZ;
  v_dow      INTEGER;
  v_now_time TIME;
  v_open     BOOLEAN := false;
BEGIN
  -- Primary active location
  SELECT id, timezone
  INTO   v_loc_id, v_tz
  FROM   business_locations
  WHERE  business_id = p_business_id
    AND  is_primary  = true
    AND  is_active   = true
  LIMIT  1;

  IF v_loc_id IS NULL THEN
    RETURN false;
  END IF;

  -- Current moment in business local time
  v_now_local := now() AT TIME ZONE v_tz;
  v_dow       := EXTRACT(dow FROM v_now_local)::INTEGER;   -- 0=Sun..6=Sat
  v_now_time  := v_now_local::TIME;

  -- Check opening_hours for today
  SELECT true INTO v_open
  FROM   opening_hours oh
  WHERE  oh.location_id  = v_loc_id
    AND  oh.entity_type  = 'business'
    AND  oh.day_of_week  = v_dow
    AND  oh.is_closed    = false
    AND  (
      -- Normal hours (doesn't cross midnight)
      (oh.crosses_midnight = false AND v_now_time BETWEEN oh.start_time AND oh.end_time)
      OR
      -- Crosses midnight: open if after start OR before end (next-day portion)
      (oh.crosses_midnight = true  AND (v_now_time >= oh.start_time OR v_now_time <= oh.end_time))
    )
  LIMIT 1;

  IF NOT FOUND OR v_open IS NULL THEN
    RETURN false;
  END IF;

  -- Check for active time_block that would override the schedule
  IF EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type  = 'business'
      AND  tb.location_id  = v_loc_id
      AND  tb.starts_at   <= now()
      AND  tb.ends_at      > now()
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ── Helper: does this business have any opening_hours window today ─────────
-- Returns TRUE when opening_hours has a non-closed row for today whose
-- end_time (or midnight+end_time for crosses_midnight) is still in the future.
-- Used for 'available_today' filter.
CREATE OR REPLACE FUNCTION private_biz_is_open_today(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc_id    UUID;
  v_tz        TEXT;
  v_now_local TIMESTAMPTZ;
  v_dow       INTEGER;
  v_now_time  TIME;
  v_open      BOOLEAN := false;
BEGIN
  SELECT id, timezone
  INTO   v_loc_id, v_tz
  FROM   business_locations
  WHERE  business_id = p_business_id
    AND  is_primary  = true
    AND  is_active   = true
  LIMIT  1;

  IF v_loc_id IS NULL THEN
    RETURN false;
  END IF;

  v_now_local := now() AT TIME ZONE v_tz;
  v_dow       := EXTRACT(dow FROM v_now_local)::INTEGER;
  v_now_time  := v_now_local::TIME;

  -- True when there's a non-closed row for today and end_time hasn't passed yet
  -- (or crosses_midnight, meaning still active)
  SELECT true INTO v_open
  FROM   opening_hours oh
  WHERE  oh.location_id  = v_loc_id
    AND  oh.entity_type  = 'business'
    AND  oh.day_of_week  = v_dow
    AND  oh.is_closed    = false
    AND  (
      oh.crosses_midnight = true          -- still running into tomorrow
      OR oh.end_time > v_now_time         -- hasn't ended yet today
    )
  LIMIT 1;

  RETURN COALESCE(v_open, false);
END;
$$;

-- ==========================================================================
-- RPC 1: set_business_live_status
-- ==========================================================================
-- Sets profiles.live_status for a given business profile.
-- Only active staff of that business can call this.
--
-- Parameters
--   p_business_id  UUID — profiles.id where is_business = true
--   p_status       TEXT — one of: available_now, available_today, by_schedule, unavailable
--
-- Returns JSONB
--   success: { "ok": true,  "status": "<new_status>" }
--   failure: { "ok": false, "error": "<code>" }
--
-- Error codes
--   not_authenticated — auth.uid() is NULL
--   invalid_status    — p_status not in allowed set
--   not_authorized    — caller is not active staff of p_business_id
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.set_business_live_status(
  p_business_id UUID,
  p_status      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('available_now', 'available_today', 'by_schedule', 'unavailable') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  -- Must be active staff of this business
  IF NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE  sm.business_id = p_business_id
      AND  sm.user_id     = v_caller_id
      AND  sm.is_active   = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE profiles
  SET    live_status = p_status
  WHERE  id = p_business_id;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.set_business_live_status(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_business_live_status(UUID, TEXT) TO authenticated;

-- ==========================================================================
-- RPC 2: find_bookable_profiles
-- ==========================================================================
-- Discovery RPC: returns business profiles filtered by live availability.
--
-- Availability filter semantics (p_availability_filter):
--   'available_now'   — include profiles where:
--                        live_status = 'available_now'
--                       OR (live_status = 'by_schedule' AND is_open_now = true)
--                       (NB: 'available_today' profiles that are currently in-hours
--                        are NOT included — they have not set 'available_now')
--   'available_today' — include profiles where:
--                        live_status IN ('available_now','available_today')
--                       OR (live_status = 'by_schedule' AND is_open_today = true)
--   'any'             — all profiles EXCEPT live_status = 'unavailable'
--
-- Note: live_status = 'unavailable' is excluded from ALL filter values.
--       Profiles with is_business = false are excluded.
--       A profile with live_status = 'available_now' but no primary active location
--       is still returned (declaration without schedule verification).
--
-- Parameters
--   p_category            TEXT?    — filter by profiles.category (ILIKE)
--   p_city                TEXT?    — filter by profiles.city (ILIKE)
--   p_availability_filter TEXT     — 'available_now' | 'available_today' | 'any'
--   p_limit               INT      — max rows to return (default 50, max 100)
--
-- Returns TABLE
--   id              UUID
--   name            TEXT
--   avatar_url      TEXT
--   category        TEXT
--   city            TEXT
--   country         TEXT
--   average_rating  NUMERIC
--   review_count    INT
--   live_status     TEXT
--   is_open_now     BOOLEAN  — schedule check result (may differ from live_status declaration)
--   is_open_today   BOOLEAN
--   business_type   TEXT
--   is_premium      BOOLEAN
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.find_bookable_profiles(
  p_category            TEXT    DEFAULT NULL,
  p_city                TEXT    DEFAULT NULL,
  p_availability_filter TEXT    DEFAULT 'any',
  p_limit               INTEGER DEFAULT 50
)
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  avatar_url     TEXT,
  category       TEXT,
  city           TEXT,
  country        TEXT,
  average_rating NUMERIC,
  review_count   INTEGER,
  live_status    TEXT,
  is_open_now    BOOLEAN,
  is_open_today  BOOLEAN,
  business_type  TEXT,
  is_premium     BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  -- Validate filter value
  IF p_availability_filter NOT IN ('available_now', 'available_today', 'any') THEN
    RAISE EXCEPTION 'invalid_availability_filter: must be available_now | available_today | any';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.category,
    p.city,
    p.country,
    p.average_rating,
    p.review_count,
    p.live_status,
    private_biz_is_open_now(p.id)   AS is_open_now,
    private_biz_is_open_today(p.id) AS is_open_today,
    p.business_type,
    p.is_premium
  FROM profiles p
  WHERE
    p.is_business = true
    -- Never return unavailable businesses regardless of filter
    AND p.live_status <> 'unavailable'

    -- Availability filter
    AND CASE p_availability_filter
      WHEN 'available_now' THEN
        p.live_status = 'available_now'
        OR (p.live_status = 'by_schedule' AND private_biz_is_open_now(p.id))

      WHEN 'available_today' THEN
        p.live_status IN ('available_now', 'available_today')
        OR (p.live_status = 'by_schedule' AND private_biz_is_open_today(p.id))

      ELSE -- 'any'
        true
    END

    -- Optional category filter
    AND (p_category IS NULL OR p.category ILIKE p_category)

    -- Optional city filter
    AND (p_city IS NULL OR p.city ILIKE p_city)

  ORDER BY
    -- available_now first, then available_today, then by_schedule
    CASE p.live_status
      WHEN 'available_now'   THEN 1
      WHEN 'available_today' THEN 2
      ELSE                        3
    END,
    p.average_rating DESC NULLS LAST,
    p.review_count    DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

-- Public read: discovery is open to both anon and authenticated (same as get_available_slots)
REVOKE ALL ON FUNCTION public.find_bookable_profiles(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_bookable_profiles(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.find_bookable_profiles(TEXT, TEXT, TEXT, INTEGER) TO anon;
