-- Migration 030: Marketplace listing control + public RPC fixes
--
-- Changes:
--   booking_profiles: add is_marketplace_listed BOOLEAN NOT NULL DEFAULT true
--
-- New RPC:
--   set_marketplace_listed(p_business_id, p_listed) — owner-only toggle
--
-- Fixed RPCs:
--   list_trade_businesses  — now filters by is_marketplace_listed = true
--   get_public_trade_profile — fixed ts.price_from / ts.price_currency (CF-1)

-- ── 1. Schema ──────────────────────────────────────────────────────────────────

ALTER TABLE public.booking_profiles
  ADD COLUMN IF NOT EXISTS is_marketplace_listed BOOLEAN NOT NULL DEFAULT true;

-- ── 2. set_marketplace_listed ─────────────────────────────────────────────────
-- Owner-only: controls whether this trade profile appears in public listing.

CREATE OR REPLACE FUNCTION public.set_marketplace_listed(
  p_business_id UUID,
  p_listed      BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE  id       = p_business_id
      AND  owner_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE booking_profiles
     SET is_marketplace_listed = p_listed,
         updated_at            = now()
   WHERE id = p_business_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_marketplace_listed(UUID, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_marketplace_listed(UUID, BOOLEAN) FROM anon;

-- ── 3. list_trade_businesses (replace) ───────────────────────────────────────
-- Adds: AND bp.is_marketplace_listed = true to WHERE clause.

CREATE OR REPLACE FUNCTION public.list_trade_businesses(
  p_city   TEXT    DEFAULT NULL,
  p_limit  INT     DEFAULT 20,
  p_offset INT     DEFAULT 0
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
        COUNT(*)::INT                             AS cnt,
        jsonb_agg(name ORDER BY sort_order, name) AS names
      FROM tradesperson_services
      WHERE business_id = bp.id
        AND is_active   = true
    ) s ON true
    WHERE bp.profile_type         = 'tradespeople'
      AND bp.is_active            = true
      AND bp.is_marketplace_listed = true
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

-- ── 4. get_public_trade_profile (replace) ────────────────────────────────────
-- CF-1 fix: ts.price was ts.price_from; ts.currency was ts.price_currency.
-- Direct profile links remain accessible regardless of is_marketplace_listed.

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
    bp.service_area_cities, bp.business_subtype,
    bp.is_marketplace_listed
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

  -- CF-1 fix: correct column names are price_from and price_currency
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          ts.id,
      'name',        ts.name,
      'description', ts.description,
      'price_type',  ts.price_type,
      'price',       ts.price_from,
      'currency',    ts.price_currency
    ) ORDER BY ts.sort_order, ts.name
  )
  INTO v_svcs
  FROM tradesperson_services ts
  WHERE ts.business_id = p_business_id
    AND ts.is_active   = true;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id',                    v_bp.id,
      'name',                  v_bp.name,
      'description',           v_bp.description,
      'logo_url',              v_bp.logo_url,
      'contact_channels',      v_bp.contact_channels,
      'emergency_enabled',     v_bp.emergency_enabled,
      'service_area_cities',   v_bp.service_area_cities,
      'business_subtype',      v_bp.business_subtype,
      'is_marketplace_listed', v_bp.is_marketplace_listed,
      'city',                  v_city,
      'services',              COALESCE(v_svcs, '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_trade_profile(UUID)
  TO anon, authenticated;
