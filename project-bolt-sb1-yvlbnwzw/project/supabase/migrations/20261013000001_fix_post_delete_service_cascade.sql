-- ==========================================================================
-- Fix: Auto-deactivate service_catalog when its source post is deleted.
-- Also adds delete_service RPC that fully cleans up a service entry.
--
-- Problem: service_catalog.post_id has ON DELETE SET NULL, so deleting a
--   service_listing post leaves an orphan is_active=true row in
--   service_catalog. This trigger fixes that at the DB level, covering
--   ALL delete paths (API, admin, account deletion, future code).
--
-- Standalone services (post_id IS NULL) are never touched.
-- ==========================================================================

-- ── Trigger: deactivate linked service when its post is deleted ───────────

CREATE OR REPLACE FUNCTION public.handle_post_delete_service_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.post_type = 'service_listing' THEN
    UPDATE public.service_catalog
    SET is_active  = false,
        updated_at = now()
    WHERE post_id = OLD.id
      AND is_active = true;
  END IF;
  RETURN OLD;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_post_delete_service_cleanup ON public.posts;

CREATE TRIGGER trg_post_delete_service_cleanup
  BEFORE DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_delete_service_cleanup();

-- ==========================================================================
-- RPC: delete_service
-- Hard-deletes a service_catalog entry after cleaning up:
--   1. service_locations junction rows
--   2. staff_services junction rows
--   3. posts.booking_enabled = false on the linked post (if any)
--   4. service_catalog row itself
--
-- Guard: refuses if any pending/confirmed future booking exists for the
--   service, so the owner must cancel those first.
--
-- bookings.service_id has ON DELETE SET NULL, so hard delete is safe —
--   existing bookings keep their service_name_snapshot.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.delete_service(
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_biz_id  UUID;
  v_post_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Load the service and verify ownership
  SELECT business_id, post_id
  INTO   v_biz_id, v_post_id
  FROM   service_catalog
  WHERE  id = p_service_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  IF v_biz_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Block deletion if there are active/pending future bookings
  IF EXISTS (
    SELECT 1
    FROM   bookings
    WHERE  service_id = p_service_id
      AND  status     IN ('pending', 'confirmed')
      AND  starts_at  > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'has_active_bookings');
  END IF;

  -- 1. Clean up junction tables
  DELETE FROM service_locations WHERE service_id = p_service_id;
  DELETE FROM staff_services     WHERE service_id = p_service_id;

  -- 2. Disable booking flag on linked post (if any)
  IF v_post_id IS NOT NULL THEN
    UPDATE posts
    SET    booking_enabled = false
    WHERE  id = v_post_id;
  END IF;

  -- 3. Hard-delete the service row
  --    (bookings.service_id → ON DELETE SET NULL, so booking history is safe)
  DELETE FROM service_catalog WHERE id = p_service_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_service(UUID) TO authenticated;
