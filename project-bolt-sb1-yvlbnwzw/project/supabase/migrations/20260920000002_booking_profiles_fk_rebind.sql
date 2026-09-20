-- ==========================================================================
-- Migration 2 of 6: FK rebind — business_id → booking_profiles(id)
-- All 22 tables that have business_id REFERENCES profiles(id) are moved to
-- REFERENCES booking_profiles(id), preserving exact ON DELETE behaviour.
--
-- SAFE: no data is modified. All existing business_id UUID values are
-- identical to booking_profiles.id values (populated in Migration 1).
-- The constraint drop + re-add is the only change per table.
--
-- ON DELETE behaviour preserved exactly:
--   CASCADE  → 20 tables (standard cascade when booking profile is deleted)
--   RESTRICT →  1 table  (bookings — cannot delete profile with live bookings)
--   SET NULL →  1 table  (posts — nullifies business link, post survives)
--
-- Includes business_follows (found during verification, not in original audit).
-- business_follows.follower_id is intentionally left on profiles(id).
-- ==========================================================================

BEGIN;

-- 1. accommodation_bookings — CASCADE
ALTER TABLE public.accommodation_bookings
  DROP CONSTRAINT accommodation_bookings_business_id_fkey,
  ADD  CONSTRAINT accommodation_bookings_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 2. accommodation_photos — CASCADE
ALTER TABLE public.accommodation_photos
  DROP CONSTRAINT accommodation_photos_business_id_fkey,
  ADD  CONSTRAINT accommodation_photos_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 3. accommodation_settings — CASCADE (PK is business_id, FK target changes only)
ALTER TABLE public.accommodation_settings
  DROP CONSTRAINT accommodation_settings_business_id_fkey,
  ADD  CONSTRAINT accommodation_settings_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 4. accommodation_units — CASCADE
ALTER TABLE public.accommodation_units
  DROP CONSTRAINT accommodation_units_business_id_fkey,
  ADD  CONSTRAINT accommodation_units_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 5. booking_rules — CASCADE (PK is business_id, FK target changes only)
ALTER TABLE public.booking_rules
  DROP CONSTRAINT booking_rules_business_id_fkey,
  ADD  CONSTRAINT booking_rules_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 6. bookings — RESTRICT (preserve original behaviour: cannot delete a booking
--    profile that has existing reservations)
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_business_id_fkey,
  ADD  CONSTRAINT bookings_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE RESTRICT;

-- 7. business_follows — CASCADE
--    business_id = which booking profile is being followed
--    follower_id stays on profiles(id) — intentionally not changed here
ALTER TABLE public.business_follows
  DROP CONSTRAINT business_follows_business_id_fkey,
  ADD  CONSTRAINT business_follows_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 8. business_locations — CASCADE
ALTER TABLE public.business_locations
  DROP CONSTRAINT business_locations_business_id_fkey,
  ADD  CONSTRAINT business_locations_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 9. food_order_settings — CASCADE (PK is business_id, FK target changes only)
ALTER TABLE public.food_order_settings
  DROP CONSTRAINT food_order_settings_business_id_fkey,
  ADD  CONSTRAINT food_order_settings_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 10. food_orders — CASCADE
ALTER TABLE public.food_orders
  DROP CONSTRAINT food_orders_business_id_fkey,
  ADD  CONSTRAINT food_orders_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 11. menu_categories — CASCADE
ALTER TABLE public.menu_categories
  DROP CONSTRAINT menu_categories_business_id_fkey,
  ADD  CONSTRAINT menu_categories_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 12. menu_items — CASCADE
ALTER TABLE public.menu_items
  DROP CONSTRAINT menu_items_business_id_fkey,
  ADD  CONSTRAINT menu_items_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 13. posts — SET NULL (post survives when booking profile is deleted)
ALTER TABLE public.posts
  DROP CONSTRAINT posts_business_id_fkey,
  ADD  CONSTRAINT posts_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE SET NULL;

-- 14. resources — CASCADE
ALTER TABLE public.resources
  DROP CONSTRAINT resources_business_id_fkey,
  ADD  CONSTRAINT resources_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 15. restaurant_tables — CASCADE
ALTER TABLE public.restaurant_tables
  DROP CONSTRAINT restaurant_tables_business_id_fkey,
  ADD  CONSTRAINT restaurant_tables_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 16. service_catalog — CASCADE
ALTER TABLE public.service_catalog
  DROP CONSTRAINT service_catalog_business_id_fkey,
  ADD  CONSTRAINT service_catalog_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 17. staff_invitations — CASCADE
ALTER TABLE public.staff_invitations
  DROP CONSTRAINT staff_invitations_business_id_fkey,
  ADD  CONSTRAINT staff_invitations_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 18. staff_members — CASCADE
ALTER TABLE public.staff_members
  DROP CONSTRAINT staff_members_business_id_fkey,
  ADD  CONSTRAINT staff_members_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 19. table_reservations — CASCADE
ALTER TABLE public.table_reservations
  DROP CONSTRAINT table_reservations_business_id_fkey,
  ADD  CONSTRAINT table_reservations_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 20. tradesperson_quotes — CASCADE
ALTER TABLE public.tradesperson_quotes
  DROP CONSTRAINT tradesperson_quotes_business_id_fkey,
  ADD  CONSTRAINT tradesperson_quotes_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 21. tradesperson_requests — CASCADE
ALTER TABLE public.tradesperson_requests
  DROP CONSTRAINT tradesperson_requests_business_id_fkey,
  ADD  CONSTRAINT tradesperson_requests_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

-- 22. tradesperson_services — CASCADE
ALTER TABLE public.tradesperson_services
  DROP CONSTRAINT tradesperson_services_business_id_fkey,
  ADD  CONSTRAINT tradesperson_services_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.booking_profiles(id) ON DELETE CASCADE;

COMMIT;
