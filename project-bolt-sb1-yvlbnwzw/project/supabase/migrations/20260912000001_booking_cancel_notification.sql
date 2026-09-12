-- Update owner_cancel_booking to also notify the client and
-- update owner_confirm_booking to notify the client of confirmation.

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
  v_uid          UUID;
  v_biz_id       UUID;
  v_client_id    UUID;
  v_status       TEXT;
  v_service_name TEXT;
  v_starts_at    TIMESTAMPTZ;
  v_biz_name     TEXT;
  v_notif_body   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, client_id, status, service_name_snapshot, starts_at
  INTO v_biz_id, v_client_id, v_status, v_service_name, v_starts_at
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

  UPDATE bookings
  SET status              = 'cancelled',
      cancelled_at        = now(),
      cancelled_by        = v_uid,
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_booking_id;

  -- Notify the client
  SELECT COALESCE(name, 'Biznis') INTO v_biz_name
  FROM profiles WHERE id = v_biz_id;

  v_notif_body := v_biz_name || ' je otkazao/la termin za ' || v_service_name
    || ' (' || to_char(v_starts_at AT TIME ZONE 'Europe/Sarajevo', 'DD.MM.YYYY HH24:MI') || ')';

  IF p_reason IS NOT NULL AND trim(p_reason) <> '' THEN
    v_notif_body := v_notif_body || '. Razlog: ' || trim(p_reason);
  END IF;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    v_client_id,
    'booking',
    'booking_cancelled',
    'Termin otkazan',
    v_notif_body,
    jsonb_build_object(
      'booking_id',    p_booking_id,
      'business_id',   v_biz_id,
      'business_name', v_biz_name,
      'service_name',  v_service_name,
      'reason',        p_reason
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cancel_booking(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Also notify client when booking is confirmed

CREATE OR REPLACE FUNCTION public.owner_confirm_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_biz_id       UUID;
  v_client_id    UUID;
  v_status       TEXT;
  v_service_name TEXT;
  v_starts_at    TIMESTAMPTZ;
  v_biz_name     TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, client_id, status, service_name_snapshot, starts_at
  INTO v_biz_id, v_client_id, v_status, v_service_name, v_starts_at
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

  UPDATE bookings
  SET status     = 'confirmed',
      updated_at = now()
  WHERE id = p_booking_id;

  -- Notify the client
  SELECT COALESCE(name, 'Biznis') INTO v_biz_name
  FROM profiles WHERE id = v_biz_id;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    v_client_id,
    'booking',
    'booking_confirmed',
    'Termin potvrđen',
    v_biz_name || ' je potvrdio/la tvoj termin za ' || v_service_name
      || ' (' || to_char(v_starts_at AT TIME ZONE 'Europe/Sarajevo', 'DD.MM.YYYY HH24:MI') || ')',
    jsonb_build_object(
      'booking_id',    p_booking_id,
      'business_id',   v_biz_id,
      'business_name', v_biz_name,
      'service_name',  v_service_name
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_confirm_booking(UUID) TO authenticated;
