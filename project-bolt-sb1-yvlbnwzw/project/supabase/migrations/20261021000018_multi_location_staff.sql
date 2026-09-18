-- ==========================================================================
-- Multi-location staff & analytics improvements
--
-- 1. set_staff_primary_location   — owner assigns staff to a location (or null = all)
-- 2. get_staff_for_service        — updated: filters staff by primary_location_id,
--                                   includes location_name in response
-- 3. get_business_service_stats_by_location — per-location analytics
-- ==========================================================================

-- ── 1. set_staff_primary_location ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_staff_primary_location(
  p_staff_member_id UUID,
  p_location_id     UUID   -- NULL clears assignment (staff works at all locations)
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

  -- Verify the location belongs to this business (when not clearing)
  IF p_location_id IS NOT NULL THEN
    PERFORM id FROM business_locations
    WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
    END IF;
  END IF;

  UPDATE staff_members
  SET primary_location_id = p_location_id,
      updated_at          = now()
  WHERE id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_primary_location(UUID, UUID) TO authenticated;

-- ── 2. get_staff_for_service (updated) ────────────────────────────────────
--
-- Now filters by primary_location_id:
--   NULL primary_location_id → staff works at ALL locations (always shown)
--   matching primary_location_id → shown for that location
--   non-matching → hidden for that location
--
-- Also returns location_name so the client UI can show it.

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
          'role',            sm.role,
          'location_name',   bl.name
        )
        ORDER BY sm.joined_at
      ),
      '[]'::jsonb
    )
    FROM staff_members sm
    JOIN profiles p ON p.id = sm.user_id
    LEFT JOIN business_locations bl ON bl.id = sm.primary_location_id
    WHERE sm.business_id = v_biz_id
      AND sm.is_active   = true
      -- Location filter: null = all locations, specific = that location only
      AND (sm.primary_location_id IS NULL OR sm.primary_location_id = p_location_id)
      -- Service filter: no assignments = any staff; assignments = only assigned staff
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

-- ── 3. get_business_service_stats_by_location ─────────────────────────────
--
-- Same as get_business_service_stats() but filtered to one location.
-- Pass p_location_id = NULL to get all locations (identical to base RPC).

CREATE OR REPLACE FUNCTION public.get_business_service_stats_by_location(
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'created_at'))
      FROM (
        SELECT jsonb_build_object(
          'id',               sc.id,
          'name',             sc.name,
          'duration_minutes', sc.duration_minutes,
          'price',            sc.price,
          'price_type',       sc.price_type,
          'created_at',       sc.created_at,
          'upcoming_count',   COUNT(b.id) FILTER (
                                WHERE b.starts_at >= now()
                                  AND b.status IN ('pending', 'confirmed')
                              ),
          'pending_count',    COUNT(b.id) FILTER (WHERE b.status = 'pending'),
          'total_count',      COUNT(b.id) FILTER (
                                WHERE b.status IN ('confirmed', 'completed', 'no_show')
                              )
        ) AS row_data
        FROM service_catalog sc
        LEFT JOIN bookings b
          ON b.service_id  = sc.id
         AND b.business_id = v_uid
         AND (p_location_id IS NULL OR b.location_id = p_location_id)
        WHERE sc.business_id = v_uid
          AND sc.is_active   = true
        GROUP BY sc.id, sc.name, sc.duration_minutes,
                 sc.price, sc.price_type, sc.created_at
      ) sub
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_service_stats_by_location(UUID) TO authenticated;
