-- Migration 035: Add address to get_public_trade_profile RPC

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
  v_bp      RECORD;
  v_address TEXT;
  v_city    TEXT;
  v_svcs    JSONB;
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

  SELECT address, city
  INTO   v_address, v_city
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
      'address',              v_address,
      'city',                 v_city,
      'services',             COALESCE(v_svcs, '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_trade_profile(UUID)
  TO anon, authenticated;
