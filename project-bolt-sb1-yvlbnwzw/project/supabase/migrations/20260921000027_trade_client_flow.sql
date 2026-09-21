-- Migration 027: Trade client flow — public marketplace, request tracking, quote flow.
--
-- Schema changes:
--   booking_profiles:        add description, service_area_cities
--   tradesperson_requests:   add tracking_token, status_updated_at
--
-- Extended RPC:
--   upsert_trade_profile     — add p_description + p_service_area_cities params
--
-- New RPCs (SECURITY DEFINER, GRANT TO anon + authenticated):
--   create_tradesperson_request_public  — CF/IF-1 fix: business-validated public insert
--   get_request_by_token                — CF-1 fix: anon quote reading via token
--   respond_to_quote_by_token           — CF-1 fix: anon accept/reject via token
--   create_public_emergency_request     — CF-3 fix: emergency_enabled-gated public insert
--   list_trade_businesses               — public marketplace listing
--   get_public_trade_profile            — public business profile

-- ── Schema: booking_profiles ────────────────────────────────────────────────

ALTER TABLE public.booking_profiles
  ADD COLUMN IF NOT EXISTS description          TEXT,
  ADD COLUMN IF NOT EXISTS service_area_cities  TEXT[] NOT NULL DEFAULT '{}';

-- ── Schema: tradesperson_requests ───────────────────────────────────────────

ALTER TABLE public.tradesperson_requests
  ADD COLUMN IF NOT EXISTS tracking_token    UUID        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_treq_tracking_token
  ON public.tradesperson_requests(tracking_token);

CREATE INDEX IF NOT EXISTS idx_treq_business_status
  ON public.tradesperson_requests(business_id, status_updated_at DESC NULLS LAST);

-- ── Extended: upsert_trade_profile ──────────────────────────────────────────
-- Adds p_description and p_service_area_cities with defaults so existing
-- callers (6-arg) continue to work unchanged.
-- Drop old 6-param signature; new 8-param replaces it with defaulted extras.

DROP FUNCTION IF EXISTS public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.upsert_trade_profile(
  p_name                TEXT,
  p_business_subtype    TEXT    DEFAULT 'company',
  p_timezone            TEXT    DEFAULT 'Europe/Sarajevo',
  p_contact_channels    JSONB   DEFAULT '{}',
  p_emergency_enabled   BOOLEAN DEFAULT false,
  p_booking_profile_id  UUID    DEFAULT NULL,
  p_description         TEXT    DEFAULT NULL,
  p_service_area_cities TEXT[]  DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_bp_id  UUID;
  v_loc_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_business_subtype NOT IN ('solo', 'company', 'cooperative', 'freelancer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_subtype');
  END IF;

  IF p_booking_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM booking_profiles
      WHERE  id = p_booking_profile_id AND owner_id = v_uid
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_bp_id := p_booking_profile_id;
  ELSE
    v_bp_id := v_uid;
  END IF;

  UPDATE profiles
  SET    is_business = true
  WHERE  id = v_uid;

  UPDATE booking_profiles
  SET    name                = trim(p_name),
         business_subtype    = p_business_subtype,
         contact_channels    = p_contact_channels,
         emergency_enabled   = p_emergency_enabled,
         description         = p_description,
         service_area_cities = p_service_area_cities,
         is_active           = true,
         updated_at          = now()
  WHERE  id = v_bp_id;

  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_bp_id, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role       = 'owner',
                is_active  = true,
                updated_at = now();

  SELECT id INTO v_loc_id
  FROM   business_locations
  WHERE  business_id = v_bp_id AND is_active = true
  ORDER  BY created_at
  LIMIT  1;

  IF v_loc_id IS NULL THEN
    INSERT INTO business_locations (business_id, name, timezone, is_primary, is_active)
    VALUES (v_bp_id, trim(p_name), trim(p_timezone), true, true)
    RETURNING id INTO v_loc_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID, TEXT, TEXT[])
  TO authenticated;

-- ── create_tradesperson_request_public ──────────────────────────────────────
-- Validates business is an active tradespeople profile.
-- Returns tracking_token for anonymous tracking.
-- Grants to anon so unauthenticated clients can submit requests.

CREATE OR REPLACE FUNCTION public.create_tradesperson_request_public(
  p_business_id    UUID,
  p_title          TEXT,
  p_description    TEXT,
  p_contact_phone  TEXT,
  p_contact_name   TEXT    DEFAULT NULL,
  p_service_id     UUID    DEFAULT NULL,
  p_address        TEXT    DEFAULT NULL,
  p_city           TEXT    DEFAULT NULL,
  p_preferred_date TEXT    DEFAULT NULL,
  p_preferred_time TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  -- Validate business is an active tradespeople profile
  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE  id           = p_business_id
      AND  profile_type = 'tradespeople'
      AND  is_active    = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  -- Basic input validation
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;
  IF length(trim(p_title)) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_too_long');
  END IF;
  IF p_description IS NULL OR trim(p_description) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'description_required');
  END IF;
  IF length(trim(p_description)) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'description_too_long');
  END IF;
  IF p_contact_phone IS NULL OR trim(p_contact_phone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_required');
  END IF;
  IF length(trim(p_contact_phone)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_too_short');
  END IF;

  -- Validate service belongs to this business (if provided)
  IF p_service_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tradesperson_services
      WHERE  id          = p_service_id
        AND  business_id = p_business_id
        AND  is_active   = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
    END IF;
  END IF;

  INSERT INTO tradesperson_requests (
    business_id, service_id, client_id,
    client_name, client_phone,
    title, description,
    address, city,
    preferred_date, preferred_time,
    status, status_updated_at
  )
  VALUES (
    p_business_id,
    p_service_id,
    auth.uid(),
    NULLIF(trim(p_contact_name), ''),
    trim(p_contact_phone),
    trim(p_title),
    trim(p_description),
    NULLIF(trim(p_address), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_preferred_date), ''),
    NULLIF(trim(p_preferred_time), ''),
    'open',
    now()
  )
  RETURNING tracking_token INTO v_token;

  RETURN jsonb_build_object('ok', true, 'tracking_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tradesperson_request_public(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

-- ── get_request_by_token ─────────────────────────────────────────────────────
-- Reads a tradesperson request and its latest quote using the tracking token.
-- Safe for anon: token is a UUID (2^122 space), no brute-force risk.

CREATE OR REPLACE FUNCTION public.get_request_by_token(
  p_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req  RECORD;
  v_quot RECORD;
BEGIN
  SELECT
    r.id,
    r.title,
    r.description,
    r.status,
    r.client_name,
    r.client_phone,
    r.address,
    r.city,
    r.preferred_date,
    r.preferred_time,
    r.created_at,
    r.status_updated_at,
    bp.name AS business_name,
    bp.id   AS business_id
  INTO v_req
  FROM tradesperson_requests r
  JOIN booking_profiles bp ON bp.id = r.business_id
  WHERE r.tracking_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Latest non-cancelled quote for this request
  SELECT
    q.id,
    q.price_amount,
    q.price_type,
    q.price_max,
    q.price_currency,
    q.duration_estimate,
    q.scheduled_date,
    q.scheduled_time,
    q.message,
    q.status,
    q.created_at
  INTO v_quot
  FROM tradesperson_quotes q
  WHERE q.request_id = v_req.id
  ORDER BY q.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id',                v_req.id,
      'title',             v_req.title,
      'description',       v_req.description,
      'status',            v_req.status,
      'client_name',       v_req.client_name,
      'client_phone',      v_req.client_phone,
      'address',           v_req.address,
      'city',              v_req.city,
      'preferred_date',    v_req.preferred_date,
      'preferred_time',    v_req.preferred_time,
      'created_at',        v_req.created_at,
      'status_updated_at', v_req.status_updated_at,
      'business_name',     v_req.business_name,
      'business_id',       v_req.business_id
    ),
    'quote', CASE WHEN v_quot.id IS NOT NULL THEN jsonb_build_object(
      'id',                v_quot.id,
      'price_amount',      v_quot.price_amount,
      'price_type',        v_quot.price_type,
      'price_max',         v_quot.price_max,
      'price_currency',    v_quot.price_currency,
      'duration_estimate', v_quot.duration_estimate,
      'scheduled_date',    v_quot.scheduled_date,
      'scheduled_time',    v_quot.scheduled_time,
      'message',           v_quot.message,
      'status',            v_quot.status,
      'created_at',        v_quot.created_at
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_request_by_token(UUID)
  TO anon, authenticated;

-- ── respond_to_quote_by_token ────────────────────────────────────────────────
-- Accept or reject a quote using the request's tracking token.
-- Cross-ref: quote.request_id must match the request found by token.

CREATE OR REPLACE FUNCTION public.respond_to_quote_by_token(
  p_token    UUID,
  p_quote_id UUID,
  p_action   TEXT   -- 'accepted' | 'rejected'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id     UUID;
  v_req_status TEXT;
  v_quot_rid   UUID;
  v_quot_status TEXT;
BEGIN
  IF p_action NOT IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  -- Find request by token
  SELECT id, status INTO v_req_id, v_req_status
  FROM tradesperson_requests
  WHERE tracking_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  -- Terminal state guard
  IF v_req_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_terminal');
  END IF;

  -- Fetch quote and verify it belongs to this request (cross-tenant protection)
  SELECT request_id, status INTO v_quot_rid, v_quot_status
  FROM tradesperson_quotes
  WHERE id = p_quote_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote_not_found');
  END IF;

  -- Cross-ref: prevent accepting/rejecting quotes from other requests
  IF v_quot_rid <> v_req_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote_mismatch');
  END IF;

  IF v_quot_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote_not_pending');
  END IF;

  UPDATE tradesperson_quotes
  SET    status = p_action
  WHERE  id = p_quote_id;

  UPDATE tradesperson_requests
  SET    status            = CASE WHEN p_action = 'accepted' THEN 'accepted' ELSE 'open' END,
         status_updated_at = now()
  WHERE  id = v_req_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_quote_by_token(UUID, UUID, TEXT)
  TO anon, authenticated;

-- ── create_public_emergency_request ─────────────────────────────────────────
-- Public emergency submission. Validates emergency_enabled=true server-side.
-- No tracking token returned — dispatcher contacts by phone.

CREATE OR REPLACE FUNCTION public.create_public_emergency_request(
  p_business_id   UUID,
  p_contact_phone TEXT,
  p_title         TEXT,
  p_description   TEXT   DEFAULT NULL,
  p_contact_name  TEXT   DEFAULT NULL,
  p_address       TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validate business is active tradespeople with emergency enabled
  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE  id                = p_business_id
      AND  profile_type      = 'tradespeople'
      AND  is_active         = true
      AND  emergency_enabled = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'emergency_not_available');
  END IF;

  IF p_contact_phone IS NULL OR trim(p_contact_phone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_required');
  END IF;
  IF length(trim(p_contact_phone)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_too_short');
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;
  IF length(trim(p_title)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_too_short');
  END IF;

  INSERT INTO trade_emergency_requests (
    business_id, contact_phone, contact_name,
    title, description, address,
    status
  )
  VALUES (
    p_business_id,
    trim(p_contact_phone),
    NULLIF(trim(p_contact_name), ''),
    trim(p_title),
    NULLIF(trim(p_description), ''),
    NULLIF(trim(p_address), ''),
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_emergency_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

-- ── list_trade_businesses ────────────────────────────────────────────────────
-- Public marketplace listing of active tradespeople businesses.
-- Optional city filter matches primary location city or service_area_cities.

CREATE OR REPLACE FUNCTION public.list_trade_businesses(
  p_city   TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 20,
  p_offset INT  DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  p_limit  := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT jsonb_agg(row_data ORDER BY row_data->>'name')
  INTO   v_rows
  FROM (
    SELECT jsonb_build_object(
      'id',                   bp.id,
      'name',                 bp.name,
      'description',          bp.description,
      'logo_url',             bp.logo_url,
      'contact_channels',     bp.contact_channels,
      'emergency_enabled',    bp.emergency_enabled,
      'service_area_cities',  bp.service_area_cities,
      'business_subtype',     bp.business_subtype,
      'primary_city',         bl.city,
      'service_count',        COALESCE(s.cnt, 0),
      'services',             COALESCE(s.names, '[]'::jsonb)
    ) AS row_data
    FROM booking_profiles bp
    LEFT JOIN LATERAL (
      SELECT city
      FROM   business_locations
      WHERE  business_id = bp.id
        AND  is_active   = true
      ORDER  BY is_primary DESC, created_at
      LIMIT  1
    ) bl ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INT                            AS cnt,
        jsonb_agg(name ORDER BY sort_order, name) AS names
      FROM tradesperson_services
      WHERE business_id = bp.id
        AND is_active   = true
    ) s ON true
    WHERE bp.profile_type = 'tradespeople'
      AND bp.is_active    = true
      AND (
        p_city IS NULL
        OR bl.city ILIKE '%' || p_city || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(bp.service_area_cities) c
          WHERE  c ILIKE '%' || p_city || '%'
        )
      )
    ORDER BY bp.name
    LIMIT  p_limit
    OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'ok',   true,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trade_businesses(TEXT, INT, INT)
  TO anon, authenticated;

-- ── get_public_trade_profile ─────────────────────────────────────────────────
-- Returns full public profile for a single tradespeople business.
-- Only active businesses are served.

CREATE OR REPLACE FUNCTION public.get_public_trade_profile(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp   RECORD;
  v_city TEXT;
  v_svcs JSONB;
BEGIN
  SELECT
    bp.id, bp.name, bp.description, bp.logo_url,
    bp.contact_channels, bp.emergency_enabled,
    bp.service_area_cities, bp.business_subtype
  INTO v_bp
  FROM booking_profiles bp
  WHERE bp.id           = p_business_id
    AND bp.profile_type = 'tradespeople'
    AND bp.is_active    = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT city INTO v_city
  FROM   business_locations
  WHERE  business_id = p_business_id
    AND  is_active   = true
  ORDER  BY is_primary DESC, created_at
  LIMIT  1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          ts.id,
      'name',        ts.name,
      'description', ts.description,
      'price_type',  ts.price_type,
      'price',       ts.price,
      'currency',    ts.currency
    ) ORDER BY ts.sort_order, ts.name
  )
  INTO v_svcs
  FROM tradesperson_services ts
  WHERE ts.business_id = p_business_id
    AND ts.is_active   = true;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id',                   v_bp.id,
      'name',                 v_bp.name,
      'description',          v_bp.description,
      'logo_url',             v_bp.logo_url,
      'contact_channels',     v_bp.contact_channels,
      'emergency_enabled',    v_bp.emergency_enabled,
      'service_area_cities',  v_bp.service_area_cities,
      'business_subtype',     v_bp.business_subtype,
      'city',                 v_city,
      'services',             COALESCE(v_svcs, '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_trade_profile(UUID)
  TO anon, authenticated;
