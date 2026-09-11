-- ==========================================================================
-- Booking Post Link
-- Links service_catalog entries to their source service_listing post.
-- Enables: Objavi uslugu → Uključi rezervaciju → dopuni booking data → gotovo
-- ==========================================================================

-- ── Step 1: post_id FK on service_catalog ─────────────────────────────────
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

-- ── Step 2: Partial unique index ──────────────────────────────────────────
-- One post = at most one active booking entry.
-- NULL post_ids are unrestricted (standalone entries from Business Setup).
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_catalog_post_id
  ON public.service_catalog(post_id)
  WHERE post_id IS NOT NULL;

-- ── Step 3: activate_post_booking ─────────────────────────────────────────
-- Creates or updates a service_catalog entry linked to the given post.
-- Copies name and description from the post automatically.
-- Sets posts.booking_enabled = true.
-- Returns: { ok: true, service_id: UUID } or { ok: false, error: TEXT }
CREATE OR REPLACE FUNCTION public.activate_post_booking(
  p_post_id          UUID,
  p_booking_type     TEXT,
  p_duration_minutes INTEGER,
  p_capacity         INTEGER DEFAULT 1,
  p_price            NUMERIC DEFAULT 0,
  p_price_type       TEXT    DEFAULT 'fixed',
  p_currency         TEXT    DEFAULT 'BAM'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_business_id UUID;
  v_name        TEXT;
  v_description TEXT;
  v_service_id  UUID;
BEGIN
  -- Verify ownership and get post details
  SELECT
    COALESCE(NULLIF(TRIM(job_title), ''), LEFT(TRIM(text), 100), 'Usluga'),
    text,
    COALESCE(business_id, v_user_id)
  INTO v_name, v_description, v_business_id
  FROM posts
  WHERE id = p_post_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  IF p_booking_type NOT IN ('appointment_service', 'tradespeople', 'restaurant', 'accommodation', 'order', 'event') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_booking_type');
  END IF;

  IF p_duration_minutes <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_duration');
  END IF;

  -- Upsert service_catalog entry linked to this post
  INSERT INTO service_catalog (
    business_id, post_id, name, description,
    booking_type, duration_minutes, capacity,
    price, price_type, currency, is_active
  )
  VALUES (
    v_business_id, p_post_id, v_name, v_description,
    p_booking_type, p_duration_minutes, p_capacity,
    p_price, p_price_type, p_currency, true
  )
  ON CONFLICT (post_id) WHERE post_id IS NOT NULL
  DO UPDATE SET
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    booking_type     = EXCLUDED.booking_type,
    duration_minutes = EXCLUDED.duration_minutes,
    capacity         = EXCLUDED.capacity,
    price            = EXCLUDED.price,
    price_type       = EXCLUDED.price_type,
    currency         = EXCLUDED.currency,
    is_active        = true,
    updated_at       = now()
  RETURNING id INTO v_service_id;

  -- Enable booking on the post and ensure business_id is set
  UPDATE posts
  SET booking_enabled = true,
      business_id     = v_business_id
  WHERE id = p_post_id;

  RETURN json_build_object('ok', true, 'service_id', v_service_id);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_post_booking(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.activate_post_booking(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT) TO authenticated;

-- ── Step 4: deactivate_post_booking ───────────────────────────────────────
-- Marks the linked service_catalog entry as inactive.
-- Sets posts.booking_enabled = false.
-- Returns: { ok: true } or { ok: false, error: TEXT }
CREATE OR REPLACE FUNCTION public.deactivate_post_booking(
  p_post_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND user_id = v_user_id) THEN
    RETURN json_build_object('ok', false, 'error', 'post_not_found');
  END IF;

  UPDATE service_catalog
  SET is_active = false, updated_at = now()
  WHERE post_id = p_post_id;

  UPDATE posts
  SET booking_enabled = false
  WHERE id = p_post_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_post_booking(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deactivate_post_booking(UUID) TO authenticated;
