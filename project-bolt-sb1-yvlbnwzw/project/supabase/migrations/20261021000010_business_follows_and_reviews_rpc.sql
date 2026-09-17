-- Business follows + get_business_reviews RPC

-- ============================================================
-- 1. business_follows table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_follows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  follower_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, follower_id)
);

ALTER TABLE public.business_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_follows_select"
  ON public.business_follows FOR SELECT USING (true);

CREATE POLICY "business_follows_insert"
  ON public.business_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "business_follows_delete"
  ON public.business_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================================
-- 2. toggle_business_follow(p_business_id) -> JSONB
--    Returns { ok, is_following, follower_count }
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_business_follow(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID    := auth.uid();
  v_is_following BOOLEAN;
  v_count        BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS (
    SELECT 1 FROM business_follows
    WHERE business_id = p_business_id AND follower_id = v_user_id
  ) THEN
    DELETE FROM business_follows
    WHERE business_id = p_business_id AND follower_id = v_user_id;
    v_is_following := false;
  ELSE
    INSERT INTO business_follows (business_id, follower_id)
    VALUES (p_business_id, v_user_id);
    v_is_following := true;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM business_follows WHERE business_id = p_business_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'is_following',  v_is_following,
    'follower_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_business_follow(UUID) TO authenticated;

-- ============================================================
-- 3. get_business_follow_info(p_business_id) -> JSONB
--    Returns { is_following, follower_count }
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_business_follow_info(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID    := auth.uid();
  v_is_following BOOLEAN := false;
  v_count        BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM business_follows WHERE business_id = p_business_id;

  IF v_user_id IS NOT NULL THEN
    v_is_following := EXISTS (
      SELECT 1 FROM business_follows
      WHERE business_id = p_business_id AND follower_id = v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'is_following',   v_is_following,
    'follower_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_follow_info(UUID) TO authenticated, anon;

-- ============================================================
-- 4. get_business_reviews(p_business_id, p_limit) -> JSONB
--    Returns { avg_rating, total_count, reviews: [...] }
--    Uses existing reviews table (pro_id, customer_id columns)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_business_reviews(
  p_business_id UUID,
  p_limit       INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg     NUMERIC;
  v_count   BIGINT;
  v_reviews JSONB;
BEGIN
  SELECT AVG(rating), COUNT(*)
  INTO v_avg, v_count
  FROM reviews
  WHERE pro_id = p_business_id;

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
    WHERE pro_id = p_business_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) r
  JOIN profiles p ON p.id = r.customer_id;

  RETURN jsonb_build_object(
    'avg_rating',   ROUND(v_avg, 1),
    'total_count',  v_count,
    'reviews',      v_reviews
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_reviews(UUID, INT) TO authenticated, anon;

-- ============================================================
-- 5. get_followed_businesses() -> JSONB
--    Returns array of businesses the current user follows
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_followed_businesses()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',          p.id,
      'name',        p.name,
      'avatar_url',  p.avatar_url,
      'city',        p.city,
      'followed_at', f.created_at
    ) ORDER BY f.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM business_follows f
  JOIN profiles p ON p.id = f.business_id
  WHERE f.follower_id = v_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_followed_businesses() TO authenticated;
