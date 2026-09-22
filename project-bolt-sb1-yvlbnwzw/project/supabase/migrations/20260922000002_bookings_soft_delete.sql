-- Soft delete for bookings.
--
-- Instead of hard-deleting a row, owner_delete_booking now sets
-- deleted_at = now(). This preserves completed bookings in analytics
-- (get_booking_analytics has no deleted_at filter, so deleted completed
-- bookings continue to contribute to revenue, by_staff, by_service).
--
-- The bookings list in the UI filters deleted_at IS NULL so soft-deleted
-- rows are invisible in normal operation.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Rebuild the delete RPC as a soft delete.
CREATE OR REPLACE FUNCTION public.owner_delete_booking(p_booking_id UUID)
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
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
    AND  sm.role      IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  UPDATE bookings
  SET    deleted_at = now()
  WHERE  id          = p_booking_id
    AND  business_id = v_biz_id
    AND  status      IN ('completed', 'cancelled', 'no_show')
    AND  deleted_at  IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_deletable');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_booking(UUID) TO authenticated;
