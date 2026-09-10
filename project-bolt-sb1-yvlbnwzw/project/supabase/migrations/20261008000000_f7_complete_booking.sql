-- ==========================================================================
-- F7: Booking Lifecycle Completion
--   1. complete_booking() RPC — marks a confirmed booking as completed/no_show
--   2. notify_booking_status_changed() — REPLACED to add booking_completed case
-- ==========================================================================
--
-- RPC CONTRACT — complete_booking
-- ─────────────────────────────────────────────────────────────────────────
-- Function : public.complete_booking
-- Auth     : authenticated, active staff of the business only
--
-- Parameters
--   p_booking_id  UUID              — booking to finalize
--   p_status      TEXT DEFAULT 'completed'  — 'completed' or 'no_show'
--
-- Returns JSONB
--   success: { "ok": true, "booking_id": "...", "status": "..." }
--   failure: { "ok": false, "error": "<error_code>" }
--
-- Error codes
--   not_authenticated   — auth.uid() is NULL
--   booking_not_found   — booking doesn't exist
--   not_authorized      — caller is not active staff of that business
--   invalid_status      — p_status is not 'completed' or 'no_show'
--   not_confirmed       — booking.status != 'confirmed'
--   booking_not_started — p_status='no_show' but starts_at is still in the future
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id UUID,
  p_status     TEXT DEFAULT 'completed'
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

  -- 2. Validate status arg
  IF p_status NOT IN ('completed', 'no_show') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  -- 3. Load booking
  SELECT b.id, b.status, b.business_id, b.starts_at
  INTO   v_bk
  FROM   bookings b
  WHERE  b.id = p_booking_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- 4. Authorization: active staff only
  IF NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE  sm.business_id = v_bk.business_id
      AND  sm.user_id     = v_caller_id
      AND  sm.is_active   = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 5. Must be confirmed
  IF v_bk.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_confirmed');
  END IF;

  -- 6. No-show guard: appointment must have already started
  IF p_status = 'no_show' AND v_bk.starts_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_started');
  END IF;

  -- 7. Update (F4 trigger fires → notifies client)
  UPDATE bookings
  SET    status     = p_status,
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_booking(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_booking(UUID, TEXT) TO authenticated;

-- ==========================================================================
-- Replace notify_booking_status_changed to handle booking_completed case.
-- All existing cases (confirmed, cancelled) are preserved verbatim.
-- New case: confirmed → completed | no_show → notify client.
-- ==========================================================================

CREATE OR REPLACE FUNCTION notify_booking_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_meta          JSONB;
BEGIN
  -- Only act on genuine status transitions
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- pending → confirmed: notify client
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_confirmed',
      'Rezervacija potvrđena',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- * → cancelled: notify client (once, skip self-cancel)
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id,
        'booking',
        'booking_cancelled',
        'Rezervacija otkazana',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- confirmed → completed: notify client (prompt for review)
  IF OLD.status = 'confirmed' AND NEW.status = 'completed' THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_completed',
      'Vaš termin je završen',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- confirmed → no_show: notify client
  IF OLD.status = 'confirmed' AND NEW.status = 'no_show' THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_no_show',
      'Termin nije iskorišten',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists (F4) — DROP/CREATE to pick up new function body
DROP TRIGGER IF EXISTS trigger_notify_booking_status_changed ON bookings;
CREATE TRIGGER trigger_notify_booking_status_changed
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_status_changed();
