-- ==========================================================================
-- F6: Booking UI — confirm_booking RPC
-- Business staff use this to confirm pending bookings.
-- The existing F4 AFTER UPDATE trigger (notify_booking_status_changed)
-- fires automatically on status change → notifies the client.
-- ==========================================================================
--
-- RPC CONTRACT — confirm_booking
-- ─────────────────────────────────────────────────────────────────────────
-- Function : public.confirm_booking
-- Auth     : authenticated only (SECURITY DEFINER validates auth.uid())
--
-- Parameters
--   p_booking_id  UUID  — booking to confirm
--
-- Returns JSONB
--   success: { "ok": true, "booking_id": "..." }
--   failure: { "ok": false, "error": "<error_code>" }
--
-- Error codes
--   not_authenticated  — auth.uid() is NULL
--   booking_not_found  — booking doesn't exist
--   not_authorized     — caller is not active staff of that business
--   not_pending        — booking.status != 'pending'
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_bk        RECORD;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Load booking
  SELECT b.id, b.status, b.business_id
  INTO   v_bk
  FROM   bookings b
  WHERE  b.id = p_booking_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- 3. Authorization: caller must be active staff of this business
  IF NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE  sm.business_id = v_bk.business_id
      AND  sm.user_id     = v_caller_id
      AND  sm.is_active   = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 4. Must be pending
  IF v_bk.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  -- 5. Confirm (F4 trigger fires on status change → notifies client)
  UPDATE bookings
  SET    status     = 'confirmed',
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id);
END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.confirm_booking(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_booking(UUID) TO authenticated;
