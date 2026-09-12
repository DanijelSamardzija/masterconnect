-- ==========================================================================
-- Business dashboard helper RPCs
--   get_business_service_stats  — service cards with booking counts
--   owner_reassign_booking      — change assigned staff on a booking
-- ==========================================================================

-- ── get_business_service_stats ────────────────────────────────────────────
-- Returns active services of the caller's business with booking statistics.

CREATE OR REPLACE FUNCTION public.get_business_service_stats()
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
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',               sc.id,
          'name',             sc.name,
          'duration_minutes', sc.duration_minutes,
          'price',            sc.price,
          'price_type',       sc.price_type,
          'upcoming_count',   COUNT(b.id) FILTER (
                                WHERE b.starts_at >= now()
                                  AND b.status IN ('pending', 'confirmed')
                              ),
          'pending_count',    COUNT(b.id) FILTER (WHERE b.status = 'pending'),
          'total_count',      COUNT(b.id) FILTER (
                                WHERE b.status IN ('confirmed', 'completed', 'no_show')
                              )
        )
        ORDER BY sc.created_at
      )
      FROM service_catalog sc
      LEFT JOIN bookings b
        ON b.service_id   = sc.id
       AND b.business_id  = v_uid
      WHERE sc.business_id = v_uid
        AND sc.is_active   = true
      GROUP BY sc.id, sc.name, sc.duration_minutes,
               sc.price, sc.price_type, sc.created_at
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_service_stats() TO authenticated;

-- ── owner_reassign_booking ────────────────────────────────────────────────
-- Lets an owner or manager change the staff member assigned to a booking.

CREATE OR REPLACE FUNCTION public.owner_reassign_booking(
  p_booking_id      UUID,
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   TEXT;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM bookings WHERE id = p_booking_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  UPDATE bookings
  SET staff_member_id = p_staff_member_id,
      updated_at      = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reassign_booking(UUID, UUID) TO authenticated;
