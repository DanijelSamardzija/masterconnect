-- ==========================================================================
-- accept_bookings flag on staff_members
--
-- Allows a staff member (or owner for any member) to opt out of being
-- listed as an available worker during booking.
--
-- Changes:
--   1. staff_members: add accept_bookings BOOL NOT NULL DEFAULT true
--   2. get_staff_for_service: filter out accept_bookings = false
--   3. set_accept_bookings RPC: owner/manager sets for anyone, self for self
-- ==========================================================================

-- ── 1. Column ─────────────────────────────────────────────────────────────

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS accept_bookings BOOL NOT NULL DEFAULT true;

-- ── 2. get_staff_for_service (recreate with accept_bookings filter) ────────

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
    WHERE sm.business_id    = v_biz_id
      AND sm.is_active       = true
      AND sm.accept_bookings = true
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

-- ── 3. set_accept_bookings RPC ─────────────────────────────────────────────
-- Owner/manager: can set for any active staff in their business.
-- Worker/manager: can set for themselves.

CREATE OR REPLACE FUNCTION public.set_accept_bookings(
  p_staff_member_id UUID,
  p_accept          BOOL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_caller  RECORD;
  v_target  RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Load target staff member
  SELECT id, business_id INTO v_target
  FROM staff_members
  WHERE id = p_staff_member_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Load caller's role in the same business
  SELECT role, id INTO v_caller
  FROM staff_members
  WHERE user_id = v_uid AND business_id = v_target.business_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Allow: owner/manager for anyone, or caller is the target themselves
  IF v_caller.role NOT IN ('owner', 'manager') AND v_caller.id != p_staff_member_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE staff_members
  SET accept_bookings = p_accept,
      updated_at      = now()
  WHERE id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_accept_bookings(UUID, BOOL) TO authenticated;
