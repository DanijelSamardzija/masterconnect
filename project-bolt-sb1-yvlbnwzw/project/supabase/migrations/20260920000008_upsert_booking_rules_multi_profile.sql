-- ==========================================================================
-- Migration 8: Add p_booking_profile_id to upsert_booking_rules
--
-- Problem: upsert_booking_rules used auth.uid() hardcoded as business_id.
--          For a user's primary profile (id = auth.uid()) this worked.
--          For secondary profiles (id ≠ auth.uid()) the RPC silently updated
--          the primary profile's rules instead of the target profile's rules.
--
-- Fix: Add optional p_booking_profile_id UUID DEFAULT NULL.
--   • NULL  → use auth.uid() as before (backward-compat for existing callers)
--   • non-NULL → verify caller is owner/manager via staff_members, then use
--                that id as the business_id
--
-- Existing data: no rows touched; ON CONFLICT ... DO UPDATE keeps all values.
-- Existing callers (frontend without the new param): unchanged behaviour.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.upsert_booking_rules(
  p_confirmation_mode  TEXT,
  p_min_notice_minutes INTEGER,
  p_max_advance_days   INTEGER,
  p_cancellation_hours INTEGER,
  p_slot_interval_min  INTEGER,
  p_booking_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_business_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Resolve which booking profile to update
  IF p_booking_profile_id IS NULL THEN
    -- Backward-compat: primary profile (id = caller's uid)
    v_business_id := v_uid;
  ELSE
    -- Caller must be an active owner or manager of the target profile
    PERFORM 1 FROM staff_members
    WHERE  business_id = p_booking_profile_id
      AND  user_id     = v_uid
      AND  is_active   = true
      AND  role        IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_business_id := p_booking_profile_id;
  END IF;

  -- Verify the resolved id is an actual booking profile
  PERFORM 1 FROM booking_profiles WHERE id = v_business_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
  END IF;

  -- Validate inputs
  IF p_confirmation_mode NOT IN ('instant', 'requires_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_confirmation_mode');
  END IF;
  IF p_slot_interval_min NOT IN (10, 15, 20, 30, 45, 60, 90, 120) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_slot_interval');
  END IF;
  IF p_min_notice_minutes < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_min_notice');
  END IF;
  IF p_max_advance_days < 1 OR p_max_advance_days > 365 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_advance_days');
  END IF;
  IF p_cancellation_hours < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cancellation_hours');
  END IF;

  INSERT INTO booking_rules (
    business_id, confirmation_mode, min_notice_minutes, max_advance_days,
    cancellation_hours, slot_interval_min
  )
  VALUES (
    v_business_id, p_confirmation_mode, p_min_notice_minutes, p_max_advance_days,
    p_cancellation_hours, p_slot_interval_min
  )
  ON CONFLICT (business_id) DO UPDATE SET
    confirmation_mode   = EXCLUDED.confirmation_mode,
    min_notice_minutes  = EXCLUDED.min_notice_minutes,
    max_advance_days    = EXCLUDED.max_advance_days,
    cancellation_hours  = EXCLUDED.cancellation_hours,
    slot_interval_min   = EXCLUDED.slot_interval_min;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Keep old 5-arg signature accessible (PostgreSQL allows overloads; the new
-- 6-arg version is the canonical one — old callers without the new param
-- automatically use the DEFAULT NULL behaviour above).
GRANT EXECUTE ON FUNCTION public.upsert_booking_rules(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_booking_rules(TEXT, INTEGER, INTEGER, INTEGER, INTEGER)       TO authenticated;
