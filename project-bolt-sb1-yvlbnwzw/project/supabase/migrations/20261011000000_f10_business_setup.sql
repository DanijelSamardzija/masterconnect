-- ==========================================================================
-- F10: Business Setup — self-service UI for businesses to configure their
--      booking profile (F10A), service catalog (F10B), opening hours (F10C).
--      Location management (F10D) reuses existing F5 RPCs.
--
-- New RPCs:
--   upsert_my_business_profile(p_name, p_timezone)          → {ok, location_id}
--   create_service(...)                                      → {ok, service_id}
--   update_service(...)                                      → {ok}
--   deactivate_service(p_service_id)                        → {ok}
--   upsert_opening_hours(p_location_id, p_day_of_week, ...) → {ok}
--   get_opening_hours(p_location_id)                        → JSONB array
--
-- All write RPCs: VOLATILE SECURITY DEFINER SET search_path = public
-- Read RPCs: STABLE SECURITY DEFINER SET search_path = public
-- ==========================================================================

-- ── Unique index for upsert_opening_hours (business-level schedule) ────────
-- One row per (location, day) for entity_type='business'.
-- Partial index enables ON CONFLICT target in upsert_opening_hours.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_opening_hours_business_day
  ON public.opening_hours(location_id, day_of_week)
  WHERE entity_type = 'business';

-- ==========================================================================
-- F10A: upsert_my_business_profile
-- Atomically:
--   1. Sets profiles.is_business=true and name on the caller's own profile.
--   2. Creates/ensures owner row in staff_members.
--   3. Creates a default primary location if none exists for this business.
-- Called when a user first enables booking, and any time they save the profile.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.upsert_my_business_profile(
  p_name     TEXT,
  p_timezone TEXT DEFAULT 'Europe/Sarajevo'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_loc_id   UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_timezone IS NULL OR trim(p_timezone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'timezone_required');
  END IF;

  -- 1. Activate business flag + update name on the caller's own profile
  UPDATE profiles
  SET    is_business = true,
         name        = trim(p_name)
  WHERE  id = v_uid;

  -- 2. Ensure owner row exists in staff_members
  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_uid, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role      = 'owner',
                is_active = true,
                updated_at = now();

  -- 3. Create default primary location if the business has none
  SELECT id INTO v_loc_id
  FROM business_locations
  WHERE business_id = v_uid AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    INSERT INTO business_locations (
      business_id, name, timezone, is_primary, is_active
    ) VALUES (
      v_uid,
      trim(p_name),
      trim(p_timezone),
      true,
      true
    )
    RETURNING id INTO v_loc_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_my_business_profile(TEXT, TEXT) TO authenticated;

-- ==========================================================================
-- F10B: Service Catalog CRUD
-- ==========================================================================

-- ── create_service ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_service(
  p_business_id      UUID,
  p_name             TEXT,
  p_description      TEXT    DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_price            NUMERIC DEFAULT NULL,
  p_price_type       TEXT    DEFAULT 'fixed',
  p_capacity         INTEGER DEFAULT 1,
  p_booking_type     TEXT    DEFAULT 'appointment_service'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_svc_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duration_invalid');
  END IF;

  IF p_price_type NOT IN ('fixed', 'from', 'negotiable', 'free') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_type_invalid');
  END IF;

  IF p_booking_type NOT IN (
    'appointment_service', 'tradespeople', 'restaurant',
    'accommodation', 'order', 'event'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_type_invalid');
  END IF;

  -- Auth: caller must be owner or manager of the business
  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO service_catalog (
    business_id, name, description,
    duration_minutes, price, price_type, capacity, booking_type,
    is_active
  ) VALUES (
    p_business_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    p_duration_minutes,
    p_price,
    p_price_type,
    COALESCE(p_capacity, 1),
    p_booking_type,
    true
  )
  RETURNING id INTO v_svc_id;

  RETURN jsonb_build_object('ok', true, 'service_id', v_svc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, TEXT) TO authenticated;

-- ── update_service ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_service(
  p_service_id       UUID,
  p_name             TEXT    DEFAULT NULL,
  p_description      TEXT    DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_price            NUMERIC DEFAULT NULL,
  p_price_type       TEXT    DEFAULT NULL,
  p_capacity         INTEGER DEFAULT NULL,
  p_is_active        BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_biz_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Look up the service's business_id for auth check
  SELECT business_id INTO v_biz_id
  FROM service_catalog
  WHERE id = p_service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_duration_minutes IS NOT NULL AND p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duration_invalid');
  END IF;

  IF p_price_type IS NOT NULL AND p_price_type NOT IN ('fixed', 'from', 'negotiable', 'free') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_type_invalid');
  END IF;

  UPDATE service_catalog SET
    name             = COALESCE(NULLIF(trim(p_name), ''), name),
    description      = CASE WHEN p_description IS NOT NULL
                            THEN NULLIF(trim(p_description), '')
                            ELSE description END,
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    price            = CASE WHEN p_price IS NOT NULL THEN p_price ELSE price END,
    price_type       = COALESCE(p_price_type, price_type),
    capacity         = COALESCE(p_capacity, capacity),
    is_active        = COALESCE(p_is_active, is_active),
    updated_at       = now()
  WHERE id = p_service_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, BOOLEAN) TO authenticated;

-- ── deactivate_service ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deactivate_service(
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_biz_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM service_catalog
  WHERE id = p_service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE service_catalog
  SET is_active  = false,
      updated_at = now()
  WHERE id = p_service_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_service(UUID) TO authenticated;

-- ==========================================================================
-- F10C: Opening Hours write
-- ==========================================================================

-- ── upsert_opening_hours ───────────────────────────────────────────────────
-- Inserts or updates one business-level opening hours row for a given
-- location + day_of_week. Uses the partial unique index
-- uniq_opening_hours_business_day (entity_type='business') for conflict target.
-- p_is_closed=true: marks the day as closed (start_time/end_time still stored).
-- start_time defaults to '09:00', end_time to '17:00' when closed.

CREATE OR REPLACE FUNCTION public.upsert_opening_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,       -- 0=Sunday … 6=Saturday
  p_open_time   TIME    DEFAULT '09:00',
  p_close_time  TIME    DEFAULT '17:00',
  p_is_closed   BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_biz_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_day_of_week NOT BETWEEN 0 AND 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  -- Look up the business_id via the location
  SELECT business_id INTO v_biz_id
  FROM business_locations
  WHERE id = p_location_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO opening_hours (
    entity_type, location_id, day_of_week,
    start_time, end_time, is_closed
  ) VALUES (
    'business',
    p_location_id,
    p_day_of_week,
    COALESCE(p_open_time,  '09:00'),
    COALESCE(p_close_time, '17:00'),
    COALESCE(p_is_closed, false)
  )
  ON CONFLICT (location_id, day_of_week)
  WHERE entity_type = 'business'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'),
    end_time   = COALESCE(p_close_time, '17:00'),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_opening_hours(UUID, INTEGER, TIME, TIME, BOOLEAN) TO authenticated;

-- ── get_opening_hours ──────────────────────────────────────────────────────
-- Returns the business-level opening hours for a location as a JSONB array.
-- Missing days are filled with defaults (open 09:00-17:00, is_closed=false).
-- Ordered day_of_week 0–6 (Sun=0).

CREATE OR REPLACE FUNCTION public.get_opening_hours(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(
    jsonb_build_object(
      'day_of_week', d.d,
      'start_time',  COALESCE(oh.start_time::TEXT, '09:00'),
      'end_time',    COALESCE(oh.end_time::TEXT,   '17:00'),
      'is_closed',   COALESCE(oh.is_closed, false)
    )
    ORDER BY d.d
  )
  FROM generate_series(0, 6) AS d(d)
  LEFT JOIN opening_hours oh
         ON oh.location_id  = p_location_id
        AND oh.day_of_week  = d.d
        AND oh.entity_type  = 'business';
$$;

GRANT EXECUTE ON FUNCTION public.get_opening_hours(UUID) TO authenticated, anon;
