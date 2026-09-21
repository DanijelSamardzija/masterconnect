-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: Trade Analytics RPC
-- get_trade_analytics — aggregates trade_jobs financial data + request funnel
-- Security: SECURITY DEFINER, authenticated only, explicit membership check
-- Financial data gated by owner/manager role OR can_view_financials permission
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_analytics(
  p_business_id  UUID,
  p_date_from    DATE,
  p_date_to      DATE,
  p_staff_id     UUID DEFAULT NULL,
  p_origin_type  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_role          TEXT;
  v_perms         JSONB;
  v_can_fin       BOOLEAN;

  -- currency
  v_currency            TEXT    := 'BAM';

  -- job summary
  v_total_jobs          BIGINT  := 0;
  v_completed           BIGINT  := 0;
  v_cancelled           BIGINT  := 0;
  v_in_progress         BIGINT  := 0;
  v_invoiced            BIGINT  := 0;
  v_total_revenue       NUMERIC := 0;
  v_total_labor         NUMERIC := 0;
  v_total_materials     NUMERIC := 0;
  v_total_expenses      NUMERIC := 0;

  -- request funnel
  v_req_total           BIGINT := 0;
  v_req_open            BIGINT := 0;
  v_req_quoted          BIGINT := 0;
  v_req_accepted        BIGINT := 0;
  v_req_completed       BIGINT := 0;
  v_req_cancelled       BIGINT := 0;
  v_emergency_total     BIGINT := 0;

  v_by_status     JSONB;
  v_by_origin     JSONB;
  v_expenses_type JSONB;
BEGIN
  -- ── 1. Auth check ──────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- ── 2. Business membership + role check ───────────────────────────────────
  SELECT sm.role, sm.permissions
    INTO v_role, v_perms
    FROM staff_members sm
    JOIN booking_profiles bp ON bp.id = sm.business_id
   WHERE sm.business_id = p_business_id
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
     AND bp.profile_type = 'tradespeople'
     AND bp.is_active    = true
   LIMIT 1;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  -- ── 3. Financial gate ─────────────────────────────────────────────────────
  v_can_fin := v_role IN ('owner', 'manager')
               OR COALESCE((v_perms->>'can_view_financials')::boolean, false);

  -- ── 4. Date validation ────────────────────────────────────────────────────
  IF p_date_from IS NULL OR p_date_to IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dates_required');
  END IF;
  IF p_date_from > p_date_to THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_date_range');
  END IF;

  -- ── 5. Dominant currency (same MODE() pattern as get_booking_analytics) ──
  SELECT COALESCE(
    (SELECT MODE() WITHIN GROUP (ORDER BY COALESCE(ts.price_currency, 'BAM'))
       FROM tradesperson_services ts
      WHERE ts.business_id = p_business_id
        AND ts.is_active   = true
    ), 'BAM'
  ) INTO v_currency;

  -- ── 6. Job aggregates ─────────────────────────────────────────────────────
  SELECT
    COUNT(*)                                              AS total_jobs,
    COUNT(*) FILTER (WHERE j.status = 'completed')       AS completed,
    COUNT(*) FILTER (WHERE j.status = 'cancelled')       AS cancelled,
    COUNT(*) FILTER (WHERE j.status = 'in_progress')     AS in_progress,
    COUNT(*) FILTER (WHERE j.is_invoiced = true)         AS invoiced,
    COALESCE(SUM(j.invoice_amount)      FILTER (WHERE j.status = 'completed'), 0) AS total_revenue,
    COALESCE(SUM(j.total_labor_cost)    FILTER (WHERE j.status = 'completed'), 0) AS total_labor,
    COALESCE(SUM(j.total_materials_cost)FILTER (WHERE j.status = 'completed'), 0) AS total_materials,
    COALESCE(SUM(j.total_expenses)      FILTER (WHERE j.status = 'completed'), 0) AS total_expenses
  INTO
    v_total_jobs, v_completed, v_cancelled, v_in_progress, v_invoiced,
    v_total_revenue, v_total_labor, v_total_materials, v_total_expenses
  FROM trade_jobs j
  WHERE j.business_id = p_business_id
    AND j.created_at::date BETWEEN p_date_from AND p_date_to
    AND (p_staff_id   IS NULL OR j.assigned_to = p_staff_id)
    AND (p_origin_type IS NULL OR j.origin_type = p_origin_type);

  -- ── 7. By-status breakdown ────────────────────────────────────────────────
  SELECT jsonb_agg(
    jsonb_build_object('status', s.status, 'count', s.cnt)
    ORDER BY s.cnt DESC
  )
  INTO v_by_status
  FROM (
    SELECT j.status, COUNT(*) AS cnt
    FROM trade_jobs j
    WHERE j.business_id = p_business_id
      AND j.created_at::date BETWEEN p_date_from AND p_date_to
      AND (p_staff_id    IS NULL OR j.assigned_to = p_staff_id)
      AND (p_origin_type IS NULL OR j.origin_type = p_origin_type)
    GROUP BY j.status
  ) s;

  -- ── 8. By-origin breakdown ────────────────────────────────────────────────
  SELECT jsonb_agg(
    jsonb_build_object('origin_type', o.origin_type, 'count', o.cnt)
    ORDER BY o.cnt DESC
  )
  INTO v_by_origin
  FROM (
    SELECT j.origin_type, COUNT(*) AS cnt
    FROM trade_jobs j
    WHERE j.business_id = p_business_id
      AND j.created_at::date BETWEEN p_date_from AND p_date_to
      AND (p_staff_id    IS NULL OR j.assigned_to = p_staff_id)
      AND (p_origin_type IS NULL OR j.origin_type = p_origin_type)
    GROUP BY j.origin_type
  ) o;

  -- ── 9. Expenses by type (only if can_view_financials) ─────────────────────
  IF v_can_fin THEN
    SELECT jsonb_agg(
      jsonb_build_object('expense_type', e.expense_type, 'total', e.total)
      ORDER BY e.total DESC
    )
    INTO v_expenses_type
    FROM (
      SELECT ex.expense_type, COALESCE(SUM(ex.amount), 0) AS total
      FROM trade_job_expenses ex
      JOIN trade_jobs j ON j.id = ex.job_id
      WHERE ex.business_id = p_business_id
        AND j.created_at::date BETWEEN p_date_from AND p_date_to
        AND (p_staff_id    IS NULL OR j.assigned_to = p_staff_id)
        AND (p_origin_type IS NULL OR j.origin_type = p_origin_type)
      GROUP BY ex.expense_type
    ) e;
  END IF;

  -- ── 10. Request funnel ───────────────────────────────────────────────────
  SELECT
    COUNT(*)                                                     AS total,
    COUNT(*) FILTER (WHERE r.status = 'open')                    AS open,
    COUNT(*) FILTER (WHERE r.status = 'quoted')                  AS quoted,
    COUNT(*) FILTER (WHERE r.status = 'accepted')                AS accepted,
    COUNT(*) FILTER (WHERE r.status = 'completed')               AS completed,
    COUNT(*) FILTER (WHERE r.status IN ('cancelled', 'declined')) AS cancelled
  INTO
    v_req_total, v_req_open, v_req_quoted, v_req_accepted, v_req_completed, v_req_cancelled
  FROM tradesperson_requests r
  WHERE r.business_id = p_business_id
    AND r.created_at::date BETWEEN p_date_from AND p_date_to;

  -- ── 11. Emergency requests count ─────────────────────────────────────────
  SELECT COUNT(*)
    INTO v_emergency_total
    FROM trade_emergency_requests e
   WHERE e.business_id = p_business_id
     AND e.created_at::date BETWEEN p_date_from AND p_date_to;

  -- ── 12. Build response ───────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                   true,
    'currency',             v_currency,
    'can_view_financials',  v_can_fin,
    'summary', jsonb_build_object(
      'total_jobs',         v_total_jobs,
      'completed',          v_completed,
      'cancelled',          v_cancelled,
      'in_progress',        v_in_progress,
      'invoiced',           v_invoiced,
      'total_revenue',      CASE WHEN v_can_fin THEN v_total_revenue    ELSE NULL END,
      'total_labor_cost',   CASE WHEN v_can_fin THEN v_total_labor      ELSE NULL END,
      'total_materials_cost',CASE WHEN v_can_fin THEN v_total_materials ELSE NULL END,
      'total_expenses',     CASE WHEN v_can_fin THEN v_total_expenses   ELSE NULL END,
      'gross_profit',       CASE WHEN v_can_fin THEN
                              v_total_revenue - v_total_labor - v_total_materials - v_total_expenses
                            ELSE NULL END
    ),
    'by_status',            COALESCE(v_by_status, '[]'::jsonb),
    'by_origin_type',       COALESCE(v_by_origin, '[]'::jsonb),
    'expenses_by_type',     CASE WHEN v_can_fin THEN COALESCE(v_expenses_type, '[]'::jsonb) ELSE NULL END,
    'request_funnel', jsonb_build_object(
      'total',     v_req_total,
      'open',      v_req_open,
      'quoted',    v_req_quoted,
      'accepted',  v_req_accepted,
      'completed', v_req_completed,
      'cancelled', v_req_cancelled
    ),
    'emergency_requests',   v_emergency_total
  );
END;
$$;

-- authenticated only — never anon
GRANT EXECUTE ON FUNCTION public.get_trade_analytics(UUID, DATE, DATE, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trade_analytics(UUID, DATE, DATE, UUID, TEXT) FROM anon;
