-- Migration 037: Add is_open_now to list_trade_businesses
-- Uses the primary location's opening_hours for today (Europe/Belgrade TZ).
-- is_open_now: true=open, false=closed, null=no hours set

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
      'avg_rating',           rv.avg_rating,
      'review_count',         rv.review_count,
      'service_count',        COALESCE(s.cnt, 0),
      'services',             COALESCE(s.names, '[]'::jsonb),
      'is_open_now',          hrs.is_open_now
    ) AS row_data
    FROM booking_profiles bp

    LEFT JOIN LATERAL (
      SELECT id, city, address
      FROM   business_locations
      WHERE  business_id = bp.id
        AND  is_active   = true
      ORDER  BY is_primary DESC, created_at
      LIMIT  1
    ) bl ON true

    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN EXISTS(
            SELECT 1 FROM opening_hours oh
            WHERE oh.location_id  = bl.id
              AND oh.entity_type  = 'business'
              AND oh.day_of_week  = EXTRACT(dow FROM now() AT TIME ZONE 'Europe/Belgrade')::int
              AND NOT oh.is_closed
              AND (now() AT TIME ZONE 'Europe/Belgrade')::time >= oh.start_time
              AND (now() AT TIME ZONE 'Europe/Belgrade')::time <  oh.end_time
          ) THEN true
          WHEN bl.id IS NOT NULL AND EXISTS(
            SELECT 1 FROM opening_hours oh
            WHERE oh.location_id = bl.id AND oh.entity_type = 'business'
          ) THEN false
          ELSE NULL
        END AS is_open_now
    ) hrs ON true

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INT                             AS cnt,
        jsonb_agg(name ORDER BY sort_order, name) AS names
      FROM tradesperson_services
      WHERE business_id = bp.id
        AND is_active   = true
    ) s ON true

    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(rating)::numeric, 1) AS avg_rating,
        COUNT(*)::INT                  AS review_count
      FROM reviews
      WHERE pro_id = bp.owner_id
    ) rv ON true

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
