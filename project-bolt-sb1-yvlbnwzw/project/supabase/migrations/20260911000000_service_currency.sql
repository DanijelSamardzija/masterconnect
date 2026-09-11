-- ==========================================================================
-- Migration: Add currency to service_catalog
-- Adds currency column and updates create_service / update_service RPCs.
-- ==========================================================================

-- ── 1. Add currency column ─────────────────────────────────────────────────

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

-- ── 2. create_service — add p_currency parameter ───────────────────────────

DROP FUNCTION IF EXISTS public.create_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, TEXT);

CREATE FUNCTION public.create_service(
  p_business_id      UUID,
  p_name             TEXT,
  p_description      TEXT    DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_price            NUMERIC DEFAULT NULL,
  p_price_type       TEXT    DEFAULT 'fixed',
  p_capacity         INTEGER DEFAULT 1,
  p_booking_type     TEXT    DEFAULT 'appointment_service',
  p_currency         TEXT    DEFAULT 'EUR'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_svc_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duration_invalid');
  END IF;

  IF p_price_type NOT IN ('fixed', 'from', 'negotiable', 'free') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_type_invalid');
  END IF;

  IF p_booking_type NOT IN (
    'appointment_service', 'tradespeople', 'restaurant',
    'accommodation', 'order', 'event'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_type_invalid');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO service_catalog (
    business_id, name, description,
    duration_minutes, price, price_type, capacity, booking_type, currency,
    is_active
  ) VALUES (
    p_business_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    p_duration_minutes,
    p_price,
    p_price_type,
    COALESCE(p_capacity, 1),
    p_booking_type,
    COALESCE(NULLIF(trim(COALESCE(p_currency, '')), ''), 'EUR'),
    true
  )
  RETURNING id INTO v_svc_id;

  RETURN jsonb_build_object('ok', true, 'service_id', v_svc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, TEXT, TEXT) TO authenticated;

-- ── 3. update_service — add p_currency parameter ───────────────────────────

DROP FUNCTION IF EXISTS public.update_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, BOOLEAN);

CREATE FUNCTION public.update_service(
  p_service_id       UUID,
  p_name             TEXT    DEFAULT NULL,
  p_description      TEXT    DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_price            NUMERIC DEFAULT NULL,
  p_price_type       TEXT    DEFAULT NULL,
  p_capacity         INTEGER DEFAULT NULL,
  p_is_active        BOOLEAN DEFAULT NULL,
  p_currency         TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
  v_biz_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM service_catalog
  WHERE id = p_service_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_duration_minutes IS NOT NULL AND p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duration_invalid');
  END IF;

  IF p_price_type IS NOT NULL AND p_price_type NOT IN ('fixed', 'from', 'negotiable', 'free') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_type_invalid');
  END IF;

  UPDATE service_catalog SET
    name             = COALESCE(NULLIF(trim(p_name), ''), name),
    description      = CASE WHEN p_description IS NOT NULL
                            THEN NULLIF(trim(p_description), '')
                            ELSE description END,
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    price            = CASE WHEN p_price IS NOT NULL THEN p_price ELSE price END,
    price_type       = COALESCE(p_price_type, price_type),
    capacity         = COALESCE(p_capacity, capacity),
    is_active        = COALESCE(p_is_active, is_active),
    currency         = COALESCE(NULLIF(trim(COALESCE(p_currency, '')), ''), currency),
    updated_at       = now()
  WHERE id = p_service_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service(UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER, BOOLEAN, TEXT) TO authenticated;
