-- Migration 033: Fix trade review system — pro_id must be profiles.id (owner_id),
-- not booking_profiles.id.
--
-- Fixed RPCs:
--   create_trade_review    — insert pro_id = bp.owner_id, not p_business_id
--   can_review_business    — check reviews using bp.owner_id
--   get_business_reviews   — query reviews using bp.owner_id
--   list_trade_businesses  — lateral join reviews on bp.owner_id

-- ── 1. can_review_business ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_review_business(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_owner_id       UUID;
  v_already_reviewed BOOLEAN;
  v_has_contact    BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'can_review', false,
                              'already_reviewed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM booking_profiles
  WHERE id = p_business_id AND profile_type = 'tradespeople';

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'can_review', false,
                              'already_reviewed', false, 'reason', 'not_found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM reviews
    WHERE customer_id = v_user_id AND pro_id = v_owner_id
  ) INTO v_already_reviewed;

  IF v_already_reviewed THEN
    RETURN jsonb_build_object('ok', true, 'can_review', false, 'already_reviewed', true);
  END IF;

  -- Contact check a: completed trade_job as client
  SELECT EXISTS(
    SELECT 1 FROM trade_jobs
    WHERE business_id = p_business_id
      AND client_id   = v_user_id
      AND status      = 'completed'
    LIMIT 1
  ) INTO v_has_contact;

  -- Contact check b: messages thread with the business owner
  IF NOT v_has_contact THEN
    SELECT EXISTS(
      SELECT 1 FROM threads
      WHERE (user1_id = v_user_id AND user2_id = v_owner_id)
         OR (user1_id = v_owner_id AND user2_id = v_user_id)
      LIMIT 1
    ) INTO v_has_contact;
  END IF;

  RETURN jsonb_build_object('ok', true, 'can_review', v_has_contact, 'already_reviewed', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_business(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_business(UUID) TO authenticated;

-- ── 2. create_trade_review ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_trade_review(
  p_business_id UUID,
  p_rating      INTEGER,
  p_comment     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_owner_id UUID;
  v_check    JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM booking_profiles
  WHERE id = p_business_id AND profile_type = 'tradespeople';

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_check := public.can_review_business(p_business_id);

  IF (v_check->>'already_reviewed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
  END IF;

  IF NOT (v_check->>'can_review')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_contact');
  END IF;

  INSERT INTO reviews (customer_id, pro_id, rating, comment)
  VALUES (v_user_id, v_owner_id, p_rating, NULLIF(TRIM(COALESCE(p_comment, '')), ''));

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_trade_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_trade_review(UUID, INTEGER, TEXT) TO authenticated;

-- ── 3. get_business_reviews ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_business_reviews(
  p_business_id UUID,
  p_limit       INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_avg      NUMERIC;
  v_count    BIGINT;
  v_reviews  JSONB;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM booking_profiles
  WHERE id = p_business_id AND profile_type = 'tradespeople';

  -- Fall back to treating p_business_id as profiles.id directly
  IF v_owner_id IS NULL THEN
    v_owner_id := p_business_id;
  END IF;

  SELECT AVG(rating), COUNT(*)
  INTO v_avg, v_count
  FROM reviews
  WHERE pro_id = v_owner_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',            r.id,
      'rating',        r.rating,
      'comment',       r.comment,
      'created_at',    r.created_at,
      'reviewer_name', p.name
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_reviews
  FROM (
    SELECT id, rating, comment, created_at, customer_id
    FROM reviews
    WHERE pro_id = v_owner_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) r
  JOIN profiles p ON p.id = r.customer_id;

  RETURN jsonb_build_object(
    'avg_rating',  ROUND(v_avg, 1),
    'total_count', v_count,
    'reviews',     v_reviews
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_reviews(UUID, INT) TO authenticated, anon;

-- ── 4. list_trade_businesses — reviews via owner_id ──────────────────────────

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
