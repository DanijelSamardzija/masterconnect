-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 031: Trade Reviews — unique constraint + contact-gated RPCs
-- Duplicate check confirmed 0 rows before applying unique index.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Unique index ───────────────────────────────────────────────────────────
-- Prevents one customer from reviewing the same business twice.
-- Pre-flight confirmed zero (customer_id, pro_id) duplicates in reviews table.

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_customer_pro
  ON public.reviews(customer_id, pro_id);

-- ── 2. can_review_business ────────────────────────────────────────────────────
-- Returns whether the authenticated user can leave a review for a business.
-- Contact rules:
--   a) At least one completed trade_job where client_id = auth.uid()
--   b) OR an existing messages thread between auth.uid() and the business owner

CREATE OR REPLACE FUNCTION public.can_review_business(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID := auth.uid();
  v_already_reviewed BOOLEAN;
  v_has_contact     BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'can_review', false,
      'already_reviewed', false,
      'reason', 'not_authenticated'
    );
  END IF;

  -- Already reviewed?
  SELECT EXISTS(
    SELECT 1 FROM reviews
    WHERE customer_id = v_user_id AND pro_id = p_business_id
  ) INTO v_already_reviewed;

  IF v_already_reviewed THEN
    RETURN jsonb_build_object(
      'ok', true,
      'can_review', false,
      'already_reviewed', true
    );
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
      WHERE (user1_id = v_user_id AND user2_id = p_business_id)
         OR (user1_id = p_business_id AND user2_id = v_user_id)
      LIMIT 1
    ) INTO v_has_contact;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'can_review', v_has_contact,
    'already_reviewed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_business(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_business(UUID) TO   authenticated;

-- ── 3. create_trade_review ────────────────────────────────────────────────────
-- Creates a review from the authenticated user for a tradespeople business.
-- Enforces contact rule via can_review_business.

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
  v_user_id UUID := auth.uid();
  v_check   JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  v_check := public.can_review_business(p_business_id);

  IF (v_check->>'already_reviewed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
  END IF;

  IF NOT (v_check->>'can_review')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_contact');
  END IF;

  INSERT INTO reviews (customer_id, pro_id, rating, comment)
  VALUES (v_user_id, p_business_id, p_rating, NULLIF(TRIM(COALESCE(p_comment, '')), ''));

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_trade_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_trade_review(UUID, INTEGER, TEXT) TO   authenticated;
