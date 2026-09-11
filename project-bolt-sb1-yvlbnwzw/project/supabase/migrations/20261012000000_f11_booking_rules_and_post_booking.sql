-- F11A: get_booking_rules — returns current rules or safe defaults
CREATE OR REPLACE FUNCTION public.get_booking_rules(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row booking_rules%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM booking_rules WHERE business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'confirmation_mode',   'instant',
      'min_notice_minutes',  60,
      'max_advance_days',    60,
      'cancellation_hours',  24,
      'slot_interval_min',   15
    );
  END IF;
  RETURN jsonb_build_object(
    'confirmation_mode',   v_row.confirmation_mode,
    'min_notice_minutes',  v_row.min_notice_minutes,
    'max_advance_days',    v_row.max_advance_days,
    'cancellation_hours',  v_row.cancellation_hours,
    'slot_interval_min',   v_row.slot_interval_min
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_rules(UUID) TO authenticated;

-- F11A: upsert_booking_rules — only the business owner may write
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
  IF p_max_advance_days < 1 OR p_max_advance_days > 60 THEN
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

-- F11B: set_post_booking_enabled — owner-only, sets business_id atomically
CREATE OR REPLACE FUNCTION public.set_post_booking_enabled(
  p_post_id UUID,
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_is_business BOOLEAN;
  v_post_owner  UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT is_business INTO v_is_business FROM profiles WHERE id = v_caller;
  IF NOT FOUND OR NOT COALESCE(v_is_business, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
  END IF;

  SELECT user_id INTO v_post_owner
  FROM posts
  WHERE id = p_post_id AND post_type = 'service_listing';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;
  IF v_post_owner != v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  UPDATE posts
  SET
    booking_enabled = p_enabled,
    business_id     = CASE WHEN p_enabled THEN v_caller ELSE NULL END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_post_booking_enabled(UUID, BOOLEAN) TO authenticated;
