-- ==========================================================================
-- F5: Multi-location Management — create / update / deactivate locations
-- Table + RLS + indexes all in F0. This file contains only the RPCs.
-- No UI in this phase → no i18n keys added here.
-- ==========================================================================
--
-- BUSINESS RULES
-- ─────────────────────────────────────────────────────────────────────────
-- • Every business must have ≥ 1 active location at all times.
--   → deactivate_location is blocked when it would be the last active one.
-- • Exactly one location per business may have is_primary = true.
--   → create_location / update_location with is_primary=true atomically
--     demote the current primary before promoting the new one.
--   → deactivate_location on the primary auto-promotes the next active
--     location (lowest created_at) to primary.
-- • timezone is required and must be non-empty on create.
--   Callers should pass a valid IANA timezone (e.g. 'Europe/Sarajevo').
--
-- AUTHORIZATION
--   Owner  : full access (create, update, deactivate any location)
--   Manager: full access (same as owner for location management)
--   Worker : read-only (no write access via these RPCs)
--
-- RPC CONTRACTS
-- ─────────────────────────────────────────────────────────────────────────
--
-- create_location(p_business_id, p_name, p_address?, p_city?, p_country?,
--                 p_timezone?, p_latitude?, p_longitude?,
--                 p_phone?, p_email?, p_is_primary?)
--   Returns: { ok, location_id }
--   Errors:  not_authenticated | not_authorized | business_not_found |
--            location_name_empty | invalid_timezone
--
-- update_location(p_location_id, p_name?, p_address?, p_city?, p_country?,
--                 p_timezone?, p_latitude?, p_longitude?,
--                 p_phone?, p_email?, p_is_primary?)
--   Returns: { ok, location_id }
--   Errors:  not_authenticated | not_authorized | location_not_found |
--            location_name_empty | invalid_timezone
--
-- deactivate_location(p_location_id)
--   Returns: { ok, location_id }
--   Errors:  not_authenticated | not_authorized | location_not_found |
--            already_inactive | cannot_deactivate_last_location
-- ==========================================================================

-- ── create_location ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_location(
  p_business_id UUID,
  p_name        TEXT,
  p_address     TEXT    DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL,
  p_country     TEXT    DEFAULT NULL,
  p_timezone    TEXT    DEFAULT 'Europe/Sarajevo',
  p_latitude    FLOAT8  DEFAULT NULL,
  p_longitude   FLOAT8  DEFAULT NULL,
  p_phone       TEXT    DEFAULT NULL,
  p_email       TEXT    DEFAULT NULL,
  p_is_primary  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_loc_id      UUID;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Input validation
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_name_empty');
  END IF;

  IF p_timezone IS NULL OR trim(p_timezone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_timezone');
  END IF;

  -- 3. Business exists
  PERFORM id FROM profiles
  WHERE id = p_business_id AND is_business = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  -- 4. Authorization: caller must be active owner or manager
  SELECT sm.role INTO v_caller_role
  FROM staff_members sm
  WHERE sm.business_id = p_business_id
    AND sm.user_id     = v_caller_id
    AND sm.is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 5. If new location should be primary, demote existing primary first
  IF p_is_primary THEN
    UPDATE business_locations
    SET    is_primary  = false,
           updated_at  = now()
    WHERE  business_id = p_business_id
      AND  is_primary  = true;
  END IF;

  -- 6. Insert the new location
  INSERT INTO business_locations (
    business_id, name, address, city, country, timezone,
    latitude, longitude, phone, email, is_primary, is_active
  ) VALUES (
    p_business_id,
    trim(p_name),
    p_address,
    p_city,
    p_country,
    trim(p_timezone),
    p_latitude,
    p_longitude,
    p_phone,
    p_email,
    p_is_primary,
    true
  )
  RETURNING id INTO v_loc_id;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

-- ── update_location ────────────────────────────────────────────────────────
-- All fields optional (NULL = keep existing value).

CREATE OR REPLACE FUNCTION public.update_location(
  p_location_id UUID,
  p_name        TEXT    DEFAULT NULL,
  p_address     TEXT    DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL,
  p_country     TEXT    DEFAULT NULL,
  p_timezone    TEXT    DEFAULT NULL,
  p_latitude    FLOAT8  DEFAULT NULL,
  p_longitude   FLOAT8  DEFAULT NULL,
  p_phone       TEXT    DEFAULT NULL,
  p_email       TEXT    DEFAULT NULL,
  p_is_primary  BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_loc         RECORD;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Load location
  SELECT id, business_id, name, is_active
  INTO   v_loc
  FROM   business_locations
  WHERE  id = p_location_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  -- 3. Validate provided inputs
  IF p_name IS NOT NULL AND trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_name_empty');
  END IF;

  IF p_timezone IS NOT NULL AND trim(p_timezone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_timezone');
  END IF;

  -- 4. Authorization: caller must be active owner or manager of that business
  SELECT sm.role INTO v_caller_role
  FROM   staff_members sm
  WHERE  sm.business_id = v_loc.business_id
    AND  sm.user_id     = v_caller_id
    AND  sm.is_active   = true
  LIMIT  1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 5. If promoting to primary, demote existing primary first
  IF p_is_primary = true THEN
    UPDATE business_locations
    SET    is_primary  = false,
           updated_at  = now()
    WHERE  business_id = v_loc.business_id
      AND  is_primary  = true
      AND  id          <> p_location_id;
  END IF;

  -- 6. Apply updates (COALESCE keeps existing value when param is NULL)
  UPDATE business_locations
  SET
    name       = COALESCE(trim(p_name),       name),
    address    = COALESCE(p_address,           address),
    city       = COALESCE(p_city,              city),
    country    = COALESCE(p_country,           country),
    timezone   = COALESCE(trim(p_timezone),    timezone),
    latitude   = COALESCE(p_latitude,          latitude),
    longitude  = COALESCE(p_longitude,         longitude),
    phone      = COALESCE(p_phone,             phone),
    email      = COALESCE(p_email,             email),
    is_primary = COALESCE(p_is_primary,        is_primary),
    updated_at = now()
  WHERE id = p_location_id;

  RETURN jsonb_build_object('ok', true, 'location_id', p_location_id);
END;
$$;

-- ── deactivate_location ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deactivate_location(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       UUID;
  v_caller_role     TEXT;
  v_loc             RECORD;
  v_active_count    INT;
  v_next_primary_id UUID;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Load location
  SELECT id, business_id, is_active, is_primary
  INTO   v_loc
  FROM   business_locations
  WHERE  id = p_location_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  -- 3. Already inactive
  IF NOT v_loc.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_inactive');
  END IF;

  -- 4. Authorization
  SELECT sm.role INTO v_caller_role
  FROM   staff_members sm
  WHERE  sm.business_id = v_loc.business_id
    AND  sm.user_id     = v_caller_id
    AND  sm.is_active   = true
  LIMIT  1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 5. Guard: cannot deactivate the last active location
  SELECT COUNT(*) INTO v_active_count
  FROM   business_locations
  WHERE  business_id = v_loc.business_id
    AND  is_active   = true;

  IF v_active_count <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_deactivate_last_location');
  END IF;

  -- 6. If deactivating the primary, auto-promote another active location
  IF v_loc.is_primary THEN
    SELECT id INTO v_next_primary_id
    FROM   business_locations
    WHERE  business_id = v_loc.business_id
      AND  is_active   = true
      AND  id          <> p_location_id
    ORDER BY created_at
    LIMIT  1;

    IF v_next_primary_id IS NOT NULL THEN
      UPDATE business_locations
      SET    is_primary = true,
             updated_at = now()
      WHERE  id = v_next_primary_id;
    END IF;
  END IF;

  -- 7. Deactivate
  UPDATE business_locations
  SET    is_active   = false,
         is_primary  = false,
         updated_at  = now()
  WHERE  id = p_location_id;

  RETURN jsonb_build_object('ok', true, 'location_id', p_location_id);
END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.create_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,FLOAT8,FLOAT8,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,FLOAT8,FLOAT8,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_location(UUID)                                                       FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,FLOAT8,FLOAT8,TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_location(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,FLOAT8,FLOAT8,TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_location(UUID)                                                       TO authenticated;
