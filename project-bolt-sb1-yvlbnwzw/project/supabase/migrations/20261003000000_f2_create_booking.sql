-- ==========================================================================
-- F2: Booking Write Path — create_booking() + cancel_booking() RPCs
-- All writes go through SECURITY DEFINER RPCs; no direct INSERT into bookings.
-- Advisory lock order (B-4 locked): staff FIRST, resource SECOND.
-- DB is UTC. payment_status='not_required' (Stripe phase deferred).
-- ==========================================================================
--
-- RPC CONTRACT — create_booking
-- ─────────────────────────────────────────────────────────────────────────
-- Function : public.create_booking
-- Auth     : authenticated only (SECURITY DEFINER validates auth.uid() != NULL)
-- Mode     : VOLATILE SECURITY DEFINER
--
-- Parameters
--   p_business_id      UUID          — business profile id
--   p_location_id      UUID          — location (for timezone + opening hours)
--   p_service_id       UUID          — service being booked
--   p_starts_at        TIMESTAMPTZ   — UTC slot start (should come from get_available_slots)
--   p_staff_member_id  UUID?         — optional: specific staff member
--   p_resource_id      UUID?         — optional: specific resource
--   p_party_size       INTEGER       — group size (default 1); counted against capacity
--   p_notes            TEXT?         — client-supplied notes
--
-- Returns JSONB
--   success: { "ok": true,  "booking_id": "...", "status": "confirmed"|"pending",
--              "confirmation_mode": "instant"|"requires_approval",
--              "starts_at": "...", "ends_at": "..." }
--   failure: { "ok": false, "error": "<error_code>" }
--
-- Error codes
--   not_authenticated       — auth.uid() is NULL
--   invalid_party_size      — p_party_size < 1
--   business_not_found      — business_id does not exist or is_business = false
--   location_not_found      — location not active or doesn't belong to business
--   service_not_found       — service not active or doesn't belong to business
--   staff_not_found         — staff member not active or doesn't belong to business
--   resource_not_found      — resource not active or doesn't belong to business
--   too_soon                — starts_at < now() + min_notice_minutes
--   too_far                 — starts_at > now() + max_advance_days
--   outside_opening_hours   — slot doesn't fall within opening hours for that day
--   time_block_conflict     — a time_block covers this slot
--   staff_conflict          — staff member has a conflicting booking
--   resource_conflict       — resource has a conflicting booking
--   capacity_full           — service capacity reached for this slot
--
-- Advisory lock order (B-4): staff namespace FIRST, resource namespace SECOND.
-- Prevents deadlock in concurrent sessions by imposing a consistent lock order.
--
-- ==========================================================================
-- RPC CONTRACT — cancel_booking
-- ─────────────────────────────────────────────────────────────────────────
-- Function : public.cancel_booking
-- Auth     : authenticated only
-- Parameters
--   p_booking_id  UUID   — booking to cancel
--   p_reason      TEXT?  — optional cancellation reason
--
-- Returns JSONB
--   success: { "ok": true,  "booking_id": "..." }
--   failure: { "ok": false, "error": "<error_code>" }
--
-- Error codes
--   not_authenticated       — auth.uid() is NULL
--   booking_not_found       — booking doesn't exist
--   not_authorized          — caller is neither the client nor business staff
--   already_cancelled       — booking.status = 'cancelled'
--   cannot_cancel_completed — booking.status in ('completed', 'no_show')
-- ==========================================================================

-- ── create_booking ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_booking(
  p_business_id     UUID,
  p_location_id     UUID,
  p_service_id      UUID,
  p_starts_at       TIMESTAMPTZ,
  p_staff_member_id UUID    DEFAULT NULL,
  p_resource_id     UUID    DEFAULT NULL,
  p_party_size      INTEGER DEFAULT 1,
  p_notes           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id        UUID;
  v_timezone         TEXT;
  v_slot_interval    INTEGER;
  v_min_notice_min   INTEGER;
  v_max_advance_days INTEGER;
  v_confirm_mode     TEXT;
  v_svc_duration     INTEGER;
  v_svc_buffer       INTEGER;
  v_svc_capacity     INTEGER;
  v_svc_booking_type TEXT;
  v_svc_name         TEXT;
  v_ends_at          TIMESTAMPTZ;
  v_booking_status   TEXT;
  v_new_booking_id   UUID;
  v_capacity_used    BIGINT;
  -- Opening hours
  v_day_local        DATE;
  v_dow              INTEGER;
  v_oh_start         TIME;
  v_oh_end           TIME;
  v_oh_is_closed     BOOLEAN;
  v_oh_crosses_mid   BOOLEAN;
  v_found_oh         BOOLEAN;
  v_open_start_utc   TIMESTAMPTZ;
  v_open_end_utc     TIMESTAMPTZ;
BEGIN
  -- ── 1. Auth ───────────────────────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- ── 2. Input validation ───────────────────────────────────────────────────
  IF p_party_size < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_party_size');
  END IF;

  -- ── 3. Business ───────────────────────────────────────────────────────────
  PERFORM id FROM profiles
  WHERE id = p_business_id AND is_business = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  -- ── 4. Location + timezone ────────────────────────────────────────────────
  SELECT bl.timezone INTO v_timezone
  FROM business_locations bl
  WHERE bl.id = p_location_id
    AND bl.business_id = p_business_id
    AND bl.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  -- ── 5. Service ────────────────────────────────────────────────────────────
  SELECT sc.duration_minutes, sc.buffer_minutes, sc.capacity,
         sc.booking_type, sc.name
  INTO   v_svc_duration, v_svc_buffer, v_svc_capacity,
         v_svc_booking_type, v_svc_name
  FROM   service_catalog sc
  WHERE  sc.id = p_service_id
    AND  sc.business_id = p_business_id
    AND  sc.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  -- ── 6. Booking rules (schema defaults as fallback) ────────────────────────
  SELECT br.slot_interval_min, br.min_notice_minutes,
         br.max_advance_days,  br.confirmation_mode
  INTO   v_slot_interval, v_min_notice_min,
         v_max_advance_days,   v_confirm_mode
  FROM   booking_rules br
  WHERE  br.business_id = p_business_id;

  IF NOT FOUND THEN
    v_slot_interval    := 15;
    v_min_notice_min   := 60;
    v_max_advance_days := 60;
    v_confirm_mode     := 'instant';
  END IF;

  -- ── 7. Optional staff validation ──────────────────────────────────────────
  IF p_staff_member_id IS NOT NULL THEN
    PERFORM id FROM staff_members
    WHERE id = p_staff_member_id
      AND business_id = p_business_id
      AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
    END IF;
  END IF;

  -- ── 8. Optional resource validation ──────────────────────────────────────
  IF p_resource_id IS NOT NULL THEN
    PERFORM id FROM resources
    WHERE id = p_resource_id
      AND business_id = p_business_id
      AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
    END IF;
  END IF;

  -- ── 9. Compute ends_at ────────────────────────────────────────────────────
  v_ends_at := p_starts_at + make_interval(mins => v_svc_duration);

  -- ── 10. Timing window validation ─────────────────────────────────────────
  IF p_starts_at < now() + make_interval(mins => v_min_notice_min) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_soon');
  END IF;

  IF p_starts_at > now() + make_interval(days => v_max_advance_days) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_far');
  END IF;

  -- ── 11. Opening hours validation ──────────────────────────────────────────
  -- Convert starts_at to local calendar date for DOW lookup
  v_day_local := (p_starts_at AT TIME ZONE v_timezone)::DATE;
  v_dow       := EXTRACT(dow FROM v_day_local)::INTEGER;

  v_found_oh := false;

  -- Prefer staff-specific hours when staff is requested
  IF p_staff_member_id IS NOT NULL THEN
    SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
    INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
    FROM   opening_hours oh
    WHERE  oh.location_id     = p_location_id
      AND  oh.entity_type     = 'staff'
      AND  oh.staff_member_id = p_staff_member_id
      AND  oh.day_of_week     = v_dow
    LIMIT 1;
    IF FOUND THEN v_found_oh := true; END IF;
  END IF;

  IF NOT v_found_oh THEN
    SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
    INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
    FROM   opening_hours oh
    WHERE  oh.location_id = p_location_id
      AND  oh.entity_type = 'business'
      AND  oh.day_of_week = v_dow
    LIMIT 1;
    IF FOUND THEN v_found_oh := true; END IF;
  END IF;

  IF NOT v_found_oh OR v_oh_is_closed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outside_opening_hours');
  END IF;

  v_open_start_utc := (v_day_local::TEXT || ' ' || v_oh_start::TEXT)::TIMESTAMP
                      AT TIME ZONE v_timezone;
  IF v_oh_crosses_mid THEN
    v_open_end_utc := ((v_day_local + 1)::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                      AT TIME ZONE v_timezone;
  ELSE
    v_open_end_utc := (v_day_local::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                      AT TIME ZONE v_timezone;
  END IF;

  IF p_starts_at < v_open_start_utc OR v_ends_at > v_open_end_utc THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outside_opening_hours');
  END IF;

  -- ── 12. Advisory locks (B-4: staff FIRST, resource SECOND) ───────────────
  -- Transaction-scoped: auto-released on COMMIT or ROLLBACK.
  -- Using 2-arg form (int, int): namespace hash + entity hash → 64-bit key.
  -- Consistent order prevents deadlock between concurrent sessions.
  IF p_staff_member_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('bk:staff'),
      hashtext(p_staff_member_id::TEXT)
    );
  END IF;

  IF p_resource_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('bk:resource'),
      hashtext(p_resource_id::TEXT)
    );
  END IF;

  -- ── 13. Conflict checks (post-lock, atomic with INSERT) ──────────────────

  -- 13a. Business-level time_block
  IF EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type = 'business'
      AND  tb.location_id = p_location_id
      AND  tb.starts_at   < v_ends_at
      AND  tb.ends_at     > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  -- 13b. Staff-level time_block
  IF p_staff_member_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type     = 'staff'
      AND  tb.staff_member_id = p_staff_member_id
      AND  tb.starts_at       < v_ends_at
      AND  tb.ends_at         > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  -- 13c. Resource-level time_block
  IF p_resource_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type = 'resource'
      AND  tb.resource_id = p_resource_id
      AND  tb.starts_at   < v_ends_at
      AND  tb.ends_at     > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  -- 13d. Staff double-booking — full symmetric buffer overlap check.
  -- An existing booking conflicts when either booking's buffer extends into the other.
  -- my_effective_end = v_ends_at + v_svc_buffer
  -- existing_effective_end = b.ends_at + b.service.buffer
  -- Conflict: p_starts_at < existing_effective_end AND b.starts_at < my_effective_end
  IF p_staff_member_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM   bookings b
    JOIN   service_catalog sc ON sc.id = b.service_id
    WHERE  b.staff_member_id = p_staff_member_id
      AND  b.status IN ('pending', 'confirmed')
      AND  p_starts_at < (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0)))
      AND  b.starts_at < (v_ends_at  + make_interval(mins => v_svc_buffer))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  -- 13e. Resource double-booking — same symmetric check
  IF p_resource_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM   bookings b
    JOIN   service_catalog sc ON sc.id = b.service_id
    WHERE  b.resource_id = p_resource_id
      AND  b.status IN ('pending', 'confirmed')
      AND  p_starts_at < (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0)))
      AND  b.starts_at < (v_ends_at  + make_interval(mins => v_svc_buffer))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_conflict');
  END IF;

  -- 13f. Service capacity — sum party_size of concurrent bookings (party-aware)
  SELECT COALESCE(SUM(b.party_size), 0)
  INTO   v_capacity_used
  FROM   bookings b
  WHERE  b.business_id = p_business_id
    AND  b.service_id  = p_service_id
    AND  b.status IN ('pending', 'confirmed')
    AND  b.starts_at  < (v_ends_at  + make_interval(mins => v_svc_buffer))
    AND  (b.ends_at   + make_interval(mins => v_svc_buffer)) > p_starts_at;

  IF v_capacity_used + p_party_size > v_svc_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_full');
  END IF;

  -- ── 14. Insert booking ────────────────────────────────────────────────────
  v_booking_status := CASE v_confirm_mode WHEN 'instant' THEN 'confirmed' ELSE 'pending' END;

  INSERT INTO bookings (
    booking_type,
    business_id,
    client_id,
    service_id,
    service_name_snapshot,
    duration_minutes,
    staff_member_id,
    location_id,
    resource_id,
    starts_at,
    ends_at,
    party_size,
    notes,
    status,
    confirmation_mode,
    payment_status
  ) VALUES (
    v_svc_booking_type,
    p_business_id,
    v_caller_id,
    p_service_id,
    v_svc_name,
    v_svc_duration,
    p_staff_member_id,
    p_location_id,
    p_resource_id,
    p_starts_at,
    v_ends_at,
    p_party_size,
    p_notes,
    v_booking_status,
    v_confirm_mode,
    'not_required'
  )
  RETURNING id INTO v_new_booking_id;

  -- ── 15. Return ────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                true,
    'booking_id',        v_new_booking_id,
    'status',            v_booking_status,
    'confirmation_mode', v_confirm_mode,
    'starts_at',         p_starts_at,
    'ends_at',           v_ends_at
  );
END;
$$;

-- ── cancel_booking ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_bk        RECORD;
BEGIN
  -- ── 1. Auth ───────────────────────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- ── 2. Load booking ───────────────────────────────────────────────────────
  SELECT b.id, b.status, b.client_id, b.business_id
  INTO   v_bk
  FROM   bookings b
  WHERE  b.id = p_booking_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- ── 3. Authorization: client OR active business staff ─────────────────────
  IF v_bk.client_id <> v_caller_id AND NOT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE  sm.business_id = v_bk.business_id
      AND  sm.user_id     = v_caller_id
      AND  sm.is_active   = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- ── 4. Status check ───────────────────────────────────────────────────────
  IF v_bk.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_cancelled');
  END IF;

  IF v_bk.status IN ('completed', 'no_show') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_cancel_completed');
  END IF;

  -- ── 5. Cancel ─────────────────────────────────────────────────────────────
  UPDATE bookings
  SET    status              = 'cancelled',
         cancelled_at        = now(),
         cancelled_by        = v_caller_id,
         cancellation_reason = p_reason,
         updated_at          = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id);
END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────
-- create_booking and cancel_booking are write operations: authenticated only.
-- anon cannot book (must log in first).

REVOKE ALL ON FUNCTION public.create_booking(UUID, UUID, UUID, TIMESTAMPTZ, UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_booking(UUID, UUID, UUID, TIMESTAMPTZ, UUID, UUID, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_booking(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancel_booking(UUID, TEXT) TO authenticated;
