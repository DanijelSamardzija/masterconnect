-- ==========================================================================
-- F12: Service-Location & Staff-Service Assignments + Staff Management RPCs
--
-- New tables:
--   service_locations(service_id, location_id) — which services at which locations
--   staff_services(staff_member_id, service_id) — which services a staff member performs
--
-- New unique index:
--   uniq_opening_hours_staff_period — enables ON CONFLICT for staff-level upsert
--
-- New RPCs:
--   set_service_locations(p_service_id, p_location_ids)        → {ok, count}
--   get_service_location_assignments(p_business_id)            → JSONB
--   set_staff_services(p_staff_member_id, p_service_ids)       → {ok, count}
--   get_staff_services(p_staff_member_id)                      → JSONB
--   get_staff_for_service(p_service_id, p_location_id)         → JSONB
--   get_my_staff(p_business_id)                                → JSONB
--   get_my_staff_invitations(p_business_id)                    → JSONB
--   upsert_staff_opening_hours(...)                            → {ok}
--   get_staff_opening_hours(p_staff_member_id, p_location_id)  → JSONB
--   delete_staff_opening_hour_period(...)                      → {ok}
--   validate_booking_readiness(p_post_id)                      → {ready, missing[]}
--   get_my_staff_bookings()                                    → TABLE
--
-- Backward-compat note: if service_locations has no entries for a service,
--   callers treat the service as available at ALL active business locations.
--   If staff_services has no entries for a service, ALL active staff can be booked.
-- ==========================================================================

-- ── Step 1: service_locations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_locations (
  service_id  UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  is_active   BOOL NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_service_locations_location
  ON public.service_locations(location_id);

-- ── Step 2: staff_services ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_services (
  staff_member_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  is_active       BOOL NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_member_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_service
  ON public.staff_services(service_id);

-- ── Step 3: unique index for staff-level opening hours ────────────────────
-- Enables ON CONFLICT in upsert_staff_opening_hours.
-- One row per (staff_member_id, location_id, day_of_week, sort_order).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_opening_hours_staff_period
  ON public.opening_hours(staff_member_id, location_id, day_of_week, sort_order)
  WHERE entity_type = 'staff';

-- ── RLS policies for new tables ───────────────────────────────────────────

ALTER TABLE public.service_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_services    ENABLE ROW LEVEL SECURITY;

-- service_locations: readable by anyone (public service catalog),
-- writable only via SECURITY DEFINER RPCs (not directly).
CREATE POLICY "service_locations_select_public"
  ON public.service_locations FOR SELECT
  USING (true);

CREATE POLICY "service_locations_no_direct_write"
  ON public.service_locations FOR INSERT
  WITH CHECK (false);

CREATE POLICY "service_locations_no_direct_update"
  ON public.service_locations FOR UPDATE
  USING (false);

CREATE POLICY "service_locations_no_direct_delete"
  ON public.service_locations FOR DELETE
  USING (false);

-- staff_services: readable by business staff, writable only via RPCs.
CREATE POLICY "staff_services_select"
  ON public.staff_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      JOIN service_catalog sc ON sc.id = staff_services.service_id
      WHERE sm.user_id = auth.uid()
        AND sm.business_id = sc.business_id
        AND sm.is_active = true
    )
  );

CREATE POLICY "staff_services_no_direct_write"
  ON public.staff_services FOR INSERT
  WITH CHECK (false);

CREATE POLICY "staff_services_no_direct_update"
  ON public.staff_services FOR UPDATE
  USING (false);

CREATE POLICY "staff_services_no_direct_delete"
  ON public.staff_services FOR DELETE
  USING (false);

-- ==========================================================================
-- RPC: set_service_locations
-- Replaces all location assignments for a service.
-- p_location_ids = '{}' removes all (service available everywhere by default).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.set_service_locations(
  p_service_id   UUID,
  p_location_ids UUID[]
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
  v_loc_id      UUID;
  v_inserted    INTEGER := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM service_catalog
  WHERE id = p_service_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Verify each location belongs to this business
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_location_ids) AS loc_id
      WHERE NOT EXISTS (
        SELECT 1 FROM business_locations bl
        WHERE bl.id = loc_id AND bl.business_id = v_biz_id AND bl.is_active = true
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_location');
    END IF;
  END IF;

  -- Delete existing
  DELETE FROM service_locations WHERE service_id = p_service_id;

  -- Insert new
  IF p_location_ids IS NOT NULL AND array_length(p_location_ids, 1) > 0 THEN
    INSERT INTO service_locations (service_id, location_id)
    SELECT p_service_id, unnest(p_location_ids)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_service_locations(UUID, UUID[]) TO authenticated;

-- ==========================================================================
-- RPC: get_service_location_assignments
-- Returns service_id → location_ids[] map for all services of a business.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_service_location_assignments(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(
      sc.id::TEXT,
      COALESCE(loc_agg.location_ids, '[]'::jsonb)
    ),
    '{}'::jsonb
  )
  FROM service_catalog sc
  LEFT JOIN (
    SELECT sl.service_id,
           jsonb_agg(sl.location_id ORDER BY sl.created_at) AS location_ids
    FROM service_locations sl
    GROUP BY sl.service_id
  ) loc_agg ON loc_agg.service_id = sc.id
  WHERE sc.business_id = p_business_id
    AND sc.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_service_location_assignments(UUID) TO authenticated;

-- ==========================================================================
-- RPC: set_staff_services
-- Replaces all service assignments for a staff member.
-- p_service_ids = '{}' removes all (staff can perform all services).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.set_staff_services(
  p_staff_member_id UUID,
  p_service_ids     UUID[]
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
  v_inserted    INTEGER := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM staff_members
  WHERE id = p_staff_member_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM staff_services WHERE staff_member_id = p_staff_member_id;

  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    INSERT INTO staff_services (staff_member_id, service_id)
    SELECT p_staff_member_id, unnest(p_service_ids)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_services(UUID, UUID[]) TO authenticated;

-- ==========================================================================
-- RPC: get_staff_services
-- Returns the list of service_ids assigned to a staff member.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_staff_services(
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(ss.service_id ORDER BY ss.created_at),
    '[]'::jsonb
  )
  FROM staff_services ss
  WHERE ss.staff_member_id = p_staff_member_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_services(UUID) TO authenticated;

-- ==========================================================================
-- RPC: get_staff_for_service
-- Returns active staff of the business who can perform p_service_id.
-- If no staff_services entries exist for that service, returns ALL active staff.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_staff_for_service(
  p_service_id  UUID,
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz_id          UUID;
  v_has_assignments BOOLEAN;
BEGIN
  SELECT sc.business_id INTO v_biz_id
  FROM service_catalog sc
  WHERE sc.id = p_service_id AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id
  ) INTO v_has_assignments;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'staff_member_id', sm.id,
          'user_id',         sm.user_id,
          'name',            p.name,
          'role',            sm.role
        )
        ORDER BY sm.joined_at
      ),
      '[]'::jsonb
    )
    FROM staff_members sm
    JOIN profiles p ON p.id = sm.user_id
    WHERE sm.business_id = v_biz_id
      AND sm.is_active   = true
      AND (
        NOT v_has_assignments
        OR EXISTS (
          SELECT 1 FROM staff_services ss
          WHERE ss.staff_member_id = sm.id AND ss.service_id = p_service_id
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_for_service(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_for_service(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_staff_for_service(UUID, UUID) TO authenticated;

-- ==========================================================================
-- RPC: get_my_staff
-- Returns all staff members with profile info for a business.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_my_staff(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                    sm.id,
          'user_id',               sm.user_id,
          'name',                  p.name,
          'email',                 p.email,
          'role',                  sm.role,
          'is_active',             sm.is_active,
          'primary_location_id',   sm.primary_location_id,
          'primary_location_name', bl.name,
          'joined_at',             sm.joined_at
        )
        ORDER BY sm.joined_at
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      LEFT JOIN business_locations bl ON bl.id = sm.primary_location_id
      WHERE sm.business_id = p_business_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff(UUID) TO authenticated;

-- ==========================================================================
-- RPC: get_my_staff_invitations
-- Returns pending and recent invitations for a business.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_my_staff_invitations(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            si.id,
          'email',         si.email,
          'role',          si.role,
          'location_id',   si.location_id,
          'location_name', bl.name,
          'status',        si.status,
          'expires_at',    si.expires_at,
          'created_at',    si.created_at
        )
        ORDER BY si.created_at DESC
      )
      FROM staff_invitations si
      LEFT JOIN business_locations bl ON bl.id = si.location_id
      WHERE si.business_id = p_business_id
        AND si.status = 'pending'
        AND si.expires_at > now()
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_invitations(UUID) TO authenticated;

-- ==========================================================================
-- RPC: upsert_staff_opening_hours
-- Sets one period of a staff member's schedule for a given location + day.
-- Auth: caller must be active owner/manager of that staff member's business.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.upsert_staff_opening_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_open_time       TIME    DEFAULT '09:00',
  p_close_time      TIME    DEFAULT '17:00',
  p_is_closed       BOOLEAN DEFAULT false,
  p_sort_order      INTEGER DEFAULT 0
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

  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.id = p_staff_member_id AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Caller must be owner or manager of that business
  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Verify location belongs to this business
  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order
  ) VALUES (
    'staff',
    p_staff_member_id,
    p_location_id,
    p_day_of_week,
    COALESCE(p_open_time,  '09:00'),
    COALESCE(p_close_time, '17:00'),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0)
  )
  ON CONFLICT (staff_member_id, location_id, day_of_week, sort_order)
  WHERE entity_type = 'staff'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'),
    end_time   = COALESCE(p_close_time, '17:00'),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_staff_opening_hours(UUID, UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER) TO authenticated;

-- ==========================================================================
-- RPC: get_staff_opening_hours
-- Returns saved periods for a staff member at a given location.
-- Returns '[]' when no hours are saved (business-level hours apply as fallback).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_staff_opening_hours(
  p_staff_member_id UUID,
  p_location_id     UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day_of_week', oh.day_of_week,
        'start_time',  oh.start_time::TEXT,
        'end_time',    oh.end_time::TEXT,
        'is_closed',   oh.is_closed,
        'sort_order',  oh.sort_order
      )
      ORDER BY oh.day_of_week, oh.sort_order
    ),
    '[]'::jsonb
  )
  FROM opening_hours oh
  WHERE oh.staff_member_id = p_staff_member_id
    AND oh.location_id     = p_location_id
    AND oh.entity_type     = 'staff';
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_opening_hours(UUID, UUID) TO authenticated;

-- ==========================================================================
-- RPC: delete_staff_opening_hour_period
-- Removes one extra period (sort_order > 0) from a staff member's schedule.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.delete_staff_opening_hour_period(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_sort_order      INTEGER
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

  IF p_sort_order IS NULL OR p_sort_order <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM staff_members
  WHERE id = p_staff_member_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM opening_hours
  WHERE staff_member_id = p_staff_member_id
    AND location_id     = p_location_id
    AND entity_type     = 'staff'
    AND day_of_week     = p_day_of_week
    AND sort_order      = p_sort_order;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_staff_opening_hour_period(UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- ==========================================================================
-- RPC: validate_booking_readiness
-- Checks all prerequisites before booking can be activated on a post.
-- Returns: {ready: bool, missing: TEXT[]}
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.validate_booking_readiness(
  p_post_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_post        RECORD;
  v_missing     TEXT[] := '{}';
  v_loc_count   INTEGER;
  v_hours_count INTEGER;
  v_svc_count   INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ready', false, 'missing', ARRAY['not_authenticated']);
  END IF;

  -- Load post
  SELECT user_id, post_type INTO v_post
  FROM posts
  WHERE id = p_post_id
  LIMIT 1;

  IF NOT FOUND OR v_post.post_type <> 'service_listing' THEN
    RETURN jsonb_build_object('ready', false, 'missing', ARRAY['post_not_found']);
  END IF;

  IF v_post.user_id <> v_uid THEN
    RETURN jsonb_build_object('ready', false, 'missing', ARRAY['not_owner']);
  END IF;

  -- Check 1: at least one active location
  SELECT COUNT(*) INTO v_loc_count
  FROM business_locations
  WHERE business_id = v_uid AND is_active = true;

  IF v_loc_count = 0 THEN
    v_missing := v_missing || 'no_location';
  END IF;

  -- Check 2: at least one location with opening hours (any non-closed day)
  SELECT COUNT(*) INTO v_hours_count
  FROM opening_hours oh
  JOIN business_locations bl ON bl.id = oh.location_id
  WHERE bl.business_id = v_uid
    AND bl.is_active    = true
    AND oh.entity_type  = 'business'
    AND oh.is_closed    = false;

  IF v_hours_count = 0 THEN
    v_missing := v_missing || 'no_hours';
  END IF;

  -- Check 3: at least one active service_catalog entry linked to this post
  SELECT COUNT(*) INTO v_svc_count
  FROM service_catalog
  WHERE post_id          = p_post_id
    AND business_id      = v_uid
    AND is_active        = true
    AND duration_minutes > 0;

  IF v_svc_count = 0 THEN
    v_missing := v_missing || 'no_service';
  END IF;

  RETURN jsonb_build_object(
    'ready',   array_length(v_missing, 1) IS NULL,
    'missing', to_jsonb(v_missing)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_booking_readiness(UUID) TO authenticated;

-- ==========================================================================
-- RPC: get_my_staff_bookings
-- Returns bookings assigned to the calling user as a staff member.
-- Used by the staff dashboard page.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_my_staff_bookings(
  p_upcoming_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  booking_id      UUID,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  status          TEXT,
  service_name    TEXT,
  duration_minutes INTEGER,
  client_name     TEXT,
  location_name   TEXT,
  notes           TEXT,
  party_size      INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id              AS booking_id,
    b.starts_at,
    b.ends_at,
    b.status,
    COALESCE(b.service_name_snapshot, sc.name, '—') AS service_name,
    b.duration_minutes,
    cp.name           AS client_name,
    bl.name           AS location_name,
    b.notes,
    b.party_size
  FROM bookings b
  JOIN staff_members sm ON sm.id = b.staff_member_id
  LEFT JOIN service_catalog sc ON sc.id = b.service_id
  LEFT JOIN profiles cp ON cp.id = b.client_id
  LEFT JOIN business_locations bl ON bl.id = b.location_id
  WHERE sm.user_id = auth.uid()
    AND (NOT p_upcoming_only OR b.starts_at >= now())
    AND b.status NOT IN ('cancelled')
  ORDER BY b.starts_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_bookings(BOOLEAN) TO authenticated;
