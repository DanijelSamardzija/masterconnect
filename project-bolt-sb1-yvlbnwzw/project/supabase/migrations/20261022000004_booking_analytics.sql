-- ==========================================================================
-- Booking Analytics
--
-- 1. Add price_snapshot to bookings + backfill + BEFORE INSERT trigger
-- 2. Composite index for analytics queries
-- 3. get_booking_analytics RPC — summary, by_staff, by_service,
--    staff_service_breakdown
-- ==========================================================================

-- ── 1a. Add price_snapshot column ─────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(10,2);

-- ── 1b. Backfill existing bookings from service_catalog (best-effort) ─────
UPDATE public.bookings b
SET    price_snapshot = sc.price
FROM   public.service_catalog sc
WHERE  b.service_id     = sc.id
  AND  b.price_snapshot IS NULL;

-- ── 1c. Trigger: auto-populate price_snapshot on INSERT ────────────────────
-- This fires on ALL create_booking / staff_create_booking / owner_create_booking
-- paths so we never need to touch those functions.
CREATE OR REPLACE FUNCTION public.set_booking_price_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price_snapshot IS NULL AND NEW.service_id IS NOT NULL THEN
    SELECT sc.price INTO NEW.price_snapshot
    FROM   service_catalog sc
    WHERE  sc.id = NEW.service_id
    LIMIT  1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_booking_price_snapshot ON public.bookings;
CREATE TRIGGER trigger_booking_price_snapshot
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_price_snapshot();

-- ── 2. Composite index for analytics ──────────────────────────────────────
-- Covers the two most common analytics query patterns:
--   business + location + date range
--   business + staff + date range
CREATE INDEX IF NOT EXISTS idx_bookings_biz_loc_status_starts
  ON public.bookings(business_id, location_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_bookings_biz_staff_status_starts
  ON public.bookings(business_id, staff_member_id, status, starts_at)
  WHERE staff_member_id IS NOT NULL;

-- ── 3. get_booking_analytics ───────────────────────────────────────────────
-- Auth: caller must be owner or manager of the business.
-- Returns:
--   summary               — totals for the requested filters
--   by_staff              — completed + revenue per staff member
--   by_service            — completed + revenue per service
--   staff_service_breakdown — flat staff × service rows (frontend groups these)

CREATE OR REPLACE FUNCTION public.get_booking_analytics(
  p_location_id UUID    DEFAULT NULL,
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_staff_id    UUID    DEFAULT NULL,
  p_service_id  UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_biz_id   UUID;
  v_tz       TEXT;
  v_from     TIMESTAMPTZ;
  v_to       TIMESTAMPTZ;
  v_summary  JSONB;
  v_by_staff JSONB;
  v_by_svc   JSONB;
  v_svc_brk  JSONB;
BEGIN
  -- 1. Auth
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Verify caller is owner/manager and get business_id
  SELECT sm.business_id INTO v_biz_id
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
    AND  sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 3. Business timezone (primary location or fallback)
  SELECT bl.timezone INTO v_tz
  FROM   business_locations bl
  WHERE  bl.business_id = v_biz_id
    AND  bl.is_primary  = true
    AND  bl.is_active   = true
  LIMIT 1;
  v_tz := COALESCE(v_tz, 'Europe/Sarajevo');

  -- 4. Convert date range to TIMESTAMPTZ (inclusive start-of-day to end-of-day)
  IF p_date_from IS NOT NULL THEN
    v_from := (p_date_from::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    -- Add 1 day so "to" date is inclusive (< next day's midnight)
    v_to := ((p_date_to + 1)::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;

  -- 5. Summary (all statuses counted for total bookings)
  SELECT jsonb_build_object(
    'total_bookings', COUNT(*),
    'completed',      COUNT(*) FILTER (WHERE b.status = 'completed'),
    'no_shows',       COUNT(*) FILTER (WHERE b.status = 'no_show'),
    'cancelled',      COUNT(*) FILTER (WHERE b.status = 'cancelled'),
    'revenue',        COALESCE(SUM(
                        CASE WHEN b.status = 'completed'
                        THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                        ELSE 0 END
                      ), 0)
  ) INTO v_summary
  FROM   bookings b
  LEFT JOIN service_catalog sc ON sc.id = b.service_id
  WHERE  b.business_id   = v_biz_id
    AND  (p_location_id IS NULL OR b.location_id      = p_location_id)
    AND  (v_from IS NULL        OR b.starts_at        >= v_from)
    AND  (v_to   IS NULL        OR b.starts_at        <  v_to)
    AND  (p_staff_id IS NULL    OR b.staff_member_id  = p_staff_id)
    AND  (p_service_id IS NULL  OR b.service_id       = p_service_id);

  -- 6. By staff (aggregated — all statuses for totals, completed-only for revenue)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'completed')::int DESC), '[]'::jsonb)
  INTO   v_by_staff
  FROM (
    SELECT jsonb_build_object(
      'staff_member_id', b.staff_member_id::TEXT,
      'staff_name',      COALESCE(p.name, '—'),
      'completed',       COUNT(*) FILTER (WHERE b.status = 'completed'),
      'no_shows',        COUNT(*) FILTER (WHERE b.status = 'no_show'),
      'revenue',         COALESCE(SUM(
                           CASE WHEN b.status = 'completed'
                           THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                           ELSE 0 END
                         ), 0)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN staff_members sm ON sm.id     = b.staff_member_id
    LEFT   JOIN profiles p        ON p.id      = sm.user_id
    LEFT   JOIN service_catalog sc ON sc.id    = b.service_id
    WHERE  b.business_id   = v_biz_id
      AND  (p_location_id IS NULL OR b.location_id     = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at       >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at       <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id      = p_service_id)
    GROUP  BY b.staff_member_id, p.name
  ) sub;

  -- 7. By service (only non-null service_name_snapshot rows matter)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'completed')::int DESC), '[]'::jsonb)
  INTO   v_by_svc
  FROM (
    SELECT jsonb_build_object(
      'service_id',   COALESCE(b.service_id::TEXT, ''),
      'service_name', COALESCE(MAX(b.service_name_snapshot), '—'),
      'completed',    COUNT(*) FILTER (WHERE b.status = 'completed'),
      'no_shows',     COUNT(*) FILTER (WHERE b.status = 'no_show'),
      'revenue',      COALESCE(SUM(
                        CASE WHEN b.status = 'completed'
                        THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                        ELSE 0 END
                      ), 0)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.business_id  = v_biz_id
      AND  (p_location_id IS NULL OR b.location_id     = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at       >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at       <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id      = p_service_id)
    GROUP  BY b.service_id, sc.price
  ) sub;

  -- 8. Staff × Service flat breakdown (only completed bookings)
  --    Frontend groups these under each staff member for the accordion detail.
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'staff_name', (row_data->>'completed')::int DESC), '[]'::jsonb)
  INTO   v_svc_brk
  FROM (
    SELECT jsonb_build_object(
      'staff_member_id', b.staff_member_id::TEXT,
      'staff_name',      COALESCE(p.name, '—'),
      'service_id',      COALESCE(b.service_id::TEXT, ''),
      'service_name',    COALESCE(MAX(b.service_name_snapshot), '—'),
      'completed',       COUNT(*),
      'revenue',         COALESCE(SUM(COALESCE(b.price_snapshot, sc.price, 0) * b.party_size), 0)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN staff_members sm ON sm.id  = b.staff_member_id
    LEFT   JOIN profiles p        ON p.id   = sm.user_id
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.business_id   = v_biz_id
      AND  b.status        = 'completed'
      AND  (p_location_id IS NULL OR b.location_id     = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at       >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at       <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id      = p_service_id)
    GROUP  BY b.staff_member_id, p.name, b.service_id, sc.price
  ) sub;

  RETURN jsonb_build_object(
    'ok',                      true,
    'summary',                 v_summary,
    'by_staff',                v_by_staff,
    'by_service',              v_by_svc,
    'staff_service_breakdown', v_svc_brk
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_analytics(UUID, DATE, DATE, UUID, UUID) TO authenticated;
