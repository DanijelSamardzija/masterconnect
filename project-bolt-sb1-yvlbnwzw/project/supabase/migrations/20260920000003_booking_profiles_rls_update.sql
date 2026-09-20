-- ==========================================================================
-- Migration 3 of 6: RLS policy update for 13 business_all policies
-- Replaces the direct `business_id = auth.uid()` pattern with a lookup
-- through get_my_business_ids(), which queries staff_members to find all
-- booking_profiles.id values the current user can manage.
--
-- WHY: After Migration 2, business_id values are booking_profiles.id UUIDs.
-- These are no longer equal to auth.uid() for multi-profile users (new
-- profiles get new UUIDs). The helper function get_my_business_ids() already
-- handles this correctly — it returns all booking_profiles.id values where
-- the caller has an active staff_members row.
--
-- SAFE: Only the 13 business_all policies are replaced. All other policies
-- (_client_all, _public_select, _public_insert, tq_client_*) are unchanged.
-- Existing beta users retain full access because:
--   - Their booking_profiles.id == profiles.id == auth.uid() (same UUID)
--   - staff_members.business_id already points to that same UUID
--   - get_my_business_ids() returns it correctly
--
-- EXPLICIT WITH CHECK: Original policies had WITH CHECK = NULL (implicitly
-- same as USING for FOR ALL). We now write it explicitly for clarity and to
-- prevent insertion under a business_id the caller doesn't own.
-- ==========================================================================

BEGIN;

-- ── accommodation_bookings ────────────────────────────────────────────────
DROP POLICY ab_business_all ON public.accommodation_bookings;
CREATE POLICY ab_business_all ON public.accommodation_bookings
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── accommodation_photos ─────────────────────────────────────────────────
DROP POLICY ap_business_all ON public.accommodation_photos;
CREATE POLICY ap_business_all ON public.accommodation_photos
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── accommodation_settings ───────────────────────────────────────────────
DROP POLICY as_business_all ON public.accommodation_settings;
CREATE POLICY as_business_all ON public.accommodation_settings
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── accommodation_units ──────────────────────────────────────────────────
DROP POLICY au_business_all ON public.accommodation_units;
CREATE POLICY au_business_all ON public.accommodation_units
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── food_order_settings ──────────────────────────────────────────────────
DROP POLICY fos_business_all ON public.food_order_settings;
CREATE POLICY fos_business_all ON public.food_order_settings
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── food_orders ──────────────────────────────────────────────────────────
DROP POLICY fo_business_all ON public.food_orders;
CREATE POLICY fo_business_all ON public.food_orders
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── menu_categories ──────────────────────────────────────────────────────
DROP POLICY mc_business_all ON public.menu_categories;
CREATE POLICY mc_business_all ON public.menu_categories
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── menu_items ───────────────────────────────────────────────────────────
DROP POLICY mi_business_all ON public.menu_items;
CREATE POLICY mi_business_all ON public.menu_items
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── restaurant_tables ────────────────────────────────────────────────────
DROP POLICY rt_business_all ON public.restaurant_tables;
CREATE POLICY rt_business_all ON public.restaurant_tables
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── table_reservations ───────────────────────────────────────────────────
DROP POLICY tr_business_all ON public.table_reservations;
CREATE POLICY tr_business_all ON public.table_reservations
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── tradesperson_quotes ──────────────────────────────────────────────────
DROP POLICY tq_business_all ON public.tradesperson_quotes;
CREATE POLICY tq_business_all ON public.tradesperson_quotes
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── tradesperson_requests ────────────────────────────────────────────────
DROP POLICY treq_business_all ON public.tradesperson_requests;
CREATE POLICY treq_business_all ON public.tradesperson_requests
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── tradesperson_services ────────────────────────────────────────────────
DROP POLICY ts_business_all ON public.tradesperson_services;
CREATE POLICY ts_business_all ON public.tradesperson_services
  FOR ALL
  USING     (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

COMMIT;
