-- Migration 026: Worker mobile RPCs + Realtime for trade_jobs.
--
-- list_my_trade_jobs              — returns only jobs assigned to caller
-- worker_update_job_status        — worker-safe status transitions
-- worker_update_emergency_status  — emergency transitions for dispatched workers
-- Realtime                        — trade_jobs added to supabase_realtime publication

-- ── Realtime: enable on trade_jobs ───────────────────────────────────────────

ALTER TABLE public.trade_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_jobs;
  END IF;
END;
$$;

-- ── list_my_trade_jobs ────────────────────────────────────────────────────────
-- Returns only jobs where assigned_to = auth.uid() for the given business.
-- Any active staff member may call this; no owner/manager role required.
-- Financial columns (purchase_price, totals) are omitted — they remain in
-- get_trade_job which respects can_view_financials server-side.

CREATE OR REPLACE FUNCTION public.list_my_trade_jobs(
  p_business_id UUID,
  p_status      TEXT    DEFAULT NULL,
  p_limit       INT     DEFAULT 50,
  p_offset      INT     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID;
  v_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Caller must be active staff of this business
  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = p_business_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_status IS NOT NULL
    AND p_status NOT IN ('pending','confirmed','in_progress','completed','on_hold','cancelled')
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  RETURN jsonb_build_object(
    'ok',   true,
    'jobs', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',             j.id,
            'title',          j.title,
            'description',    j.description,
            'status',         j.status,
            'priority',       j.priority,
            'origin_type',    j.origin_type,
            'location',       j.location,
            'scheduled_start',j.scheduled_start,
            'scheduled_end',  j.scheduled_end,
            'actual_start',   j.actual_start,
            'actual_end',     j.actual_end,
            'job_id',         j.id,
            'client_name',    tc.name,
            'client_phone',   tc.phone,
            'created_at',     j.created_at,
            'updated_at',     j.updated_at
          )
          ORDER BY
            CASE j.status
              WHEN 'in_progress' THEN 1
              WHEN 'confirmed'   THEN 2
              WHEN 'pending'     THEN 3
              WHEN 'on_hold'     THEN 4
              ELSE                    5
            END,
            j.scheduled_start ASC NULLS LAST,
            j.created_at DESC
        )
        FROM trade_jobs j
        LEFT JOIN trade_clients tc ON tc.id = j.client_id
        WHERE j.business_id  = p_business_id
          AND j.assigned_to  = v_uid
          AND (p_status IS NULL OR j.status = p_status)
        LIMIT  p_limit
        OFFSET p_offset
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_trade_jobs(UUID, TEXT, INT, INT) TO authenticated;

-- ── worker_update_job_status ──────────────────────────────────────────────────
-- Allows a worker to advance their own assigned job through a restricted set
-- of transitions.  Owner/manager tranzitions (cancel, etc.) stay in
-- update_trade_job_status which remains owner/manager-only.
--
-- Allowed for workers with can_create_job_reports (or owner/manager):
--   pending    → in_progress
--   confirmed  → in_progress
--   in_progress→ completed
--   in_progress→ on_hold
--   on_hold    → in_progress
--
-- pending → completed is intentionally NOT allowed.
-- 'cancelled' is never a target here.

CREATE OR REPLACE FUNCTION public.worker_update_job_status(
  p_job_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_biz_id    UUID;
  v_role      TEXT;
  v_perms     JSONB;
  v_cur_status TEXT;
  v_assigned  UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('in_progress', 'completed', 'on_hold') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_status');
  END IF;

  SELECT business_id, status, assigned_to
    INTO v_biz_id, v_cur_status, v_assigned
  FROM trade_jobs
  WHERE id = p_job_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  -- Cancelled jobs can never be updated
  IF v_cur_status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cancelled_job_cannot_be_reactivated');
  END IF;

  SELECT role, permissions
    INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Owner/manager can update any assigned job; workers must be assigned + have permission
  IF v_role NOT IN ('owner', 'manager') THEN
    IF v_assigned IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_assigned_to_this_job');
    END IF;
    IF NOT COALESCE((v_perms->>'can_create_job_reports')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
  END IF;

  -- Enforce transition matrix
  IF NOT (
       (v_cur_status = 'pending'     AND p_status = 'in_progress')
    OR (v_cur_status = 'confirmed'   AND p_status = 'in_progress')
    OR (v_cur_status = 'in_progress' AND p_status IN ('completed', 'on_hold'))
    OR (v_cur_status = 'on_hold'     AND p_status = 'in_progress')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition');
  END IF;

  UPDATE trade_jobs
  SET status      = p_status,
      actual_start = CASE
                       WHEN p_status = 'in_progress' AND actual_start IS NULL
                       THEN now()
                       ELSE actual_start
                     END,
      actual_end   = CASE
                       WHEN p_status = 'completed' AND actual_end IS NULL
                       THEN now()
                       ELSE actual_end
                     END,
      updated_at   = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_update_job_status(UUID, TEXT) TO authenticated;

-- ── worker_update_emergency_status ────────────────────────────────────────────
-- Allows a dispatched worker (can_handle_emergency) to update their emergency
-- status without needing can_accept_emergency.
--
-- Only callable by the worker assigned to the emergency (assigned_to = auth.uid()).
-- Allowed transitions:
--   accepted   → in_transit
--   in_transit → arrived
--
-- arrived → completed remains dispatcher/owner/manager only.
-- cancelled is never a target here.

CREATE OR REPLACE FUNCTION public.worker_update_emergency_status(
  p_request_id UUID,
  p_status     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_biz_id     UUID;
  v_role       TEXT;
  v_perms      JSONB;
  v_cur_status TEXT;
  v_assigned   UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('in_transit', 'arrived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_status');
  END IF;

  SELECT business_id, status, assigned_to
    INTO v_biz_id, v_cur_status, v_assigned
  FROM trade_emergency_requests
  WHERE id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  -- Terminal statuses cannot change
  IF v_cur_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'terminal_status_cannot_change');
  END IF;

  SELECT role, permissions
    INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Must be the assigned worker
  IF v_assigned IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_assigned_to_this_request');
  END IF;

  -- Must have can_handle_emergency (or be owner/manager)
  IF v_role NOT IN ('owner', 'manager') THEN
    IF NOT COALESCE((v_perms->>'can_handle_emergency')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
  END IF;

  -- Enforce transition matrix
  IF NOT (
       (v_cur_status = 'accepted'   AND p_status = 'in_transit')
    OR (v_cur_status = 'in_transit' AND p_status = 'arrived')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition');
  END IF;

  UPDATE trade_emergency_requests
  SET status        = p_status,
      dispatched_at = CASE
                        WHEN p_status = 'in_transit' AND dispatched_at IS NULL
                        THEN now()
                        ELSE dispatched_at
                      END,
      arrived_at    = CASE
                        WHEN p_status = 'arrived' AND arrived_at IS NULL
                        THEN now()
                        ELSE arrived_at
                      END,
      updated_at    = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_update_emergency_status(UUID, TEXT) TO authenticated;
