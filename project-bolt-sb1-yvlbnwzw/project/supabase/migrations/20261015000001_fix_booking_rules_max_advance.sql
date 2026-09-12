-- Fix: upsert_booking_rules rejected max_advance_days > 60 but UI offers 90+ days.
-- Widen the constraint to 365 days maximum.
CREATE OR REPLACE FUNCTION public.upsert_booking_rules(
  p_confirmation_mode  TEXT,
  p_min_notice_minutes INTEGER,
  p_max_advance_days   INTEGER,
  p_cancellation_hours INTEGER,
  p_slot_interval_min  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := auth.uid();
  v_is_business BOOLEAN;
BEGIN
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT is_business INTO v_is_business FROM profiles WHERE id = v_business_id;
  IF NOT FOUND OR NOT COALESCE(v_is_business, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
  END IF;

  IF p_confirmation_mode NOT IN ('instant', 'requires_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_confirmation_mode');
  END IF;
  IF p_slot_interval_min NOT IN (10, 15, 20, 30, 45, 60, 90, 120) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_slot_interval');
  END IF;
  IF p_min_notice_minutes < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_min_notice');
  END IF;
  IF p_max_advance_days < 1 OR p_max_advance_days > 365 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_advance_days');
  END IF;
  IF p_cancellation_hours < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cancellation_hours');
  END IF;

  INSERT INTO booking_rules (
    business_id, confirmation_mode, min_notice_minutes, max_advance_days,
    cancellation_hours, slot_interval_min
  )
  VALUES (
    v_business_id, p_confirmation_mode, p_min_notice_minutes, p_max_advance_days,
    p_cancellation_hours, p_slot_interval_min
  )
  ON CONFLICT (business_id) DO UPDATE SET
    confirmation_mode   = EXCLUDED.confirmation_mode,
    min_notice_minutes  = EXCLUDED.min_notice_minutes,
    max_advance_days    = EXCLUDED.max_advance_days,
    cancellation_hours  = EXCLUDED.cancellation_hours,
    slot_interval_min   = EXCLUDED.slot_interval_min;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_booking_rules(TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
