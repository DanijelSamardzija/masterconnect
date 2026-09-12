-- ============================================================
-- owner_delete_booking
-- Allows an owner/manager to permanently delete a completed or
-- cancelled booking belonging to their own business.
-- Direct client-side DELETE is blocked by RLS, so this RPC
-- runs as SECURITY DEFINER to bypass it safely.
-- ============================================================

CREATE OR REPLACE FUNCTION public.owner_delete_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid
    AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  DELETE FROM bookings
  WHERE id          = p_booking_id
    AND business_id = v_biz_id
    AND status IN ('completed', 'cancelled', 'no_show');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_deletable');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_booking(UUID) TO authenticated;
