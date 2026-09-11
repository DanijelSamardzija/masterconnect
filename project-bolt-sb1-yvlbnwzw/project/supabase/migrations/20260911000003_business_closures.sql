-- ==========================================================================
-- Business Closures (Neradni periodi / Privremeno zatvaranje)
--
-- Uses the existing time_blocks table (entity_type='business') which is
-- already checked by get_available_slots — no changes to the slot engine.
--
-- Changes:
--   1. Relax time_blocks.reason CHECK to include 'renovation' and 'other'
--   2. Index for fast closure lookup per location
--   3. get_business_closures(p_location_id)  → JSONB array
--   4. create_business_closure(...)          → {ok, closure_id?, booking_count, warning?}
--   5. delete_business_closure(p_closure_id) → {ok}
-- ==========================================================================

-- ── 1. Expand reason CHECK ────────────────────────────────────────────────────
-- Original: ('holiday', 'vacation', 'blocked', 'break')
-- Adding:   'renovation', 'other'

ALTER TABLE public.time_blocks
  DROP CONSTRAINT IF EXISTS time_blocks_reason_check;

ALTER TABLE public.time_blocks
  ADD CONSTRAINT time_blocks_reason_check
    CHECK (reason IN ('holiday', 'vacation', 'blocked', 'break', 'renovation', 'other'));

-- ── 2. Index for closure lookups ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_time_blocks_business_location
  ON public.time_blocks(location_id, starts_at)
  WHERE entity_type = 'business';

-- ── 3. get_business_closures ──────────────────────────────────────────────────
-- Returns all business-level time_blocks for a location.
-- date_from / date_to are computed in the location's timezone so the UI
-- can display them directly without knowing the timezone.

CREATE OR REPLACE FUNCTION public.get_business_closures(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',        tb.id,
        'reason',    tb.reason,
        'note',      tb.note,
        'starts_at', tb.starts_at,
        'ends_at',   tb.ends_at,
        'date_from', (tb.starts_at AT TIME ZONE bl.timezone)::DATE,
        'date_to',   ((tb.ends_at  AT TIME ZONE bl.timezone)::DATE - 1),
        'is_past',   tb.ends_at < now()
      )
      ORDER BY tb.starts_at DESC
    ),
    '[]'::jsonb
  )
  FROM time_blocks tb
  JOIN business_locations bl ON bl.id = tb.location_id
  WHERE tb.location_id = p_location_id
    AND tb.entity_type = 'business';
$$;

GRANT EXECUTE ON FUNCTION public.get_business_closures(UUID) TO authenticated;

-- ── 4. create_business_closure ────────────────────────────────────────────────
-- Converts the caller-supplied DATE range to TIMESTAMPTZ using the location
-- timezone: starts_at = midnight of date_from, ends_at = midnight of date_to+1.
-- This makes the slot engine (which compares TIMESTAMPTZ) block every slot
-- on every day in the range, regardless of the slot's local time.
--
-- If existing bookings overlap the range and p_force=false, returns a warning
-- without creating the closure so the UI can ask for confirmation first.

CREATE OR REPLACE FUNCTION public.create_business_closure(
  p_location_id UUID,
  p_date_from   DATE,
  p_date_to     DATE,
  p_reason      TEXT    DEFAULT 'vacation',
  p_note        TEXT    DEFAULT NULL,
  p_force       BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID;
  v_biz_id        UUID;
  v_caller_role   TEXT;
  v_timezone      TEXT;
  v_starts_at     TIMESTAMPTZ;
  v_ends_at       TIMESTAMPTZ;
  v_booking_count INTEGER;
  v_closure_id    UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dates_required');
  END IF;

  IF p_date_to < p_date_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'date_to_before_date_from');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('holiday', 'vacation', 'renovation', 'other', 'blocked', 'break') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  SELECT bl.business_id, bl.timezone
  INTO   v_biz_id, v_timezone
  FROM   business_locations bl
  WHERE  bl.id = p_location_id AND bl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM   staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Convert dates to TIMESTAMPTZ in the business's timezone.
  -- ends_at is midnight of the day AFTER date_to so the range is [date_from, date_to] inclusive.
  v_starts_at := (p_date_from::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;
  v_ends_at   := ((p_date_to + 1)::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;

  -- Count bookings that overlap this closure period
  SELECT COUNT(*)
  INTO   v_booking_count
  FROM   bookings b
  WHERE  b.business_id = v_biz_id
    AND  b.status      IN ('pending', 'confirmed')
    AND  b.starts_at    < v_ends_at
    AND  b.ends_at      > v_starts_at;

  -- Return warning if conflicts exist and caller hasn't forced through
  IF v_booking_count > 0 AND NOT p_force THEN
    RETURN jsonb_build_object(
      'ok',            false,
      'warning',       'has_bookings',
      'booking_count', v_booking_count
    );
  END IF;

  INSERT INTO time_blocks (entity_type, location_id, starts_at, ends_at, reason, note)
  VALUES (
    'business',
    p_location_id,
    v_starts_at,
    v_ends_at,
    COALESCE(p_reason, 'vacation'),
    p_note
  )
  RETURNING id INTO v_closure_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'closure_id',    v_closure_id,
    'booking_count', v_booking_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_business_closure(UUID, DATE, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── 5. delete_business_closure ────────────────────────────────────────────────
-- Verifies the caller is owner/manager of the business that owns the closure.

CREATE OR REPLACE FUNCTION public.delete_business_closure(
  p_closure_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT bl.business_id INTO v_biz_id
  FROM   time_blocks tb
  JOIN   business_locations bl ON bl.id = tb.location_id
  WHERE  tb.id          = p_closure_id
    AND  tb.entity_type = 'business'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM   staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM time_blocks
  WHERE  id          = p_closure_id
    AND  entity_type = 'business';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_business_closure(UUID) TO authenticated;
