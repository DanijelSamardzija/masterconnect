-- Fix: booking_confirmed and booking_cancelled notifications were inserted twice:
--   once by the DB trigger (trigger_notify_booking_status_changed)
--   once manually inside owner_confirm_booking / owner_cancel_booking.
--
-- Fix strategy:
--   1. Remove manual INSERTs from both RPCs — the trigger handles all status changes.
--   2. Improve the trigger to include business name and cancellation reason,
--      so the trigger notification has full context.

-- ── 1. Trigger: include business name + cancellation reason ───────────────────

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
  v_body          TEXT;
  v_meta          JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;
  v_business_name := COALESCE(v_business_name, 'Biznis');

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
      'Termin potvrđen',
      v_business_name || ' je potvrdio/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- * → cancelled: notify client (skip if client cancelled themselves)
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN
      v_body := v_business_name || ' je otkazao/la termin za ' || v_service_name || ' · ' || v_dt_str;
      IF NEW.cancellation_reason IS NOT NULL AND trim(NEW.cancellation_reason) <> '' THEN
        v_body := v_body || '. Razlog: ' || trim(NEW.cancellation_reason);
      END IF;

      -- include reason in meta too
      v_meta := v_meta || jsonb_build_object('reason', NEW.cancellation_reason);

      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id,
        'booking',
        'booking_cancelled',
        'Termin otkazan',
        v_body,
        v_meta
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. owner_confirm_booking: remove duplicate notification INSERT ─────────────

CREATE OR REPLACE FUNCTION public.owner_confirm_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, status
  INTO v_biz_id, v_status
  FROM bookings WHERE id = p_booking_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid
      AND is_active = true AND role IN ('owner', 'manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  -- Trigger notify_booking_status_changed fires on this UPDATE and sends booking_confirmed.
  UPDATE bookings
  SET status     = 'confirmed',
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_confirm_booking(UUID) TO authenticated;

-- ── 3. owner_cancel_booking: remove duplicate notification INSERT ──────────────

CREATE OR REPLACE FUNCTION public.owner_cancel_booking(
  p_booking_id UUID,
  p_reason     TEXT DEFAULT NULL
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
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, status
  INTO v_biz_id, v_status
  FROM bookings WHERE id = p_booking_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid
      AND is_active = true AND role IN ('owner', 'manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_finished');
  END IF;

  -- Trigger notify_booking_status_changed fires on this UPDATE and sends booking_cancelled.
  UPDATE bookings
  SET status              = 'cancelled',
      cancelled_at        = now(),
      cancelled_by        = v_uid,
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cancel_booking(UUID, TEXT) TO authenticated;
