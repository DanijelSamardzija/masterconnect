-- Migration 031: Add primary_address to list_trade_businesses RPC output.
-- No schema change — business_locations.address already exists.

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
      'primary_address',      bl.address,
      'service_count',        COALESCE(s.cnt, 0),
      'services',             COALESCE(s.names, '[]'::jsonb)
    ) AS row_data
    FROM booking_profiles bp
    LEFT JOIN LATERAL (
      SELECT city, address
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
    WHERE bp.profile_type          = 'tradespeople'
      AND bp.is_active             = true
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
