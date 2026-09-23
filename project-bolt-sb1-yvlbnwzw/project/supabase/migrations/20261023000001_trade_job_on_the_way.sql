-- feat(trade): add on_the_way status + eta_time to trade_jobs
--
-- New status: on_the_way (between confirmed and in_progress)
-- New columns: eta_time TEXT (HH:MM), on_the_way_at TIMESTAMPTZ
-- Updated RPCs: worker_update_job_status, update_trade_job_status
-- New RPC: update_trade_job_eta

-- ─── 1. Extend CHECK constraint ───────────────────────────────────────────────

ALTER TABLE public.trade_jobs
  DROP CONSTRAINT IF EXISTS trade_jobs_status_check;

ALTER TABLE public.trade_jobs
  ADD CONSTRAINT trade_jobs_status_check
    CHECK (status IN (
      'pending','confirmed','on_the_way','in_progress',
      'completed','cancelled','on_hold'
    ));

-- ─── 2. New columns ───────────────────────────────────────────────────────────

ALTER TABLE public.trade_jobs
  ADD COLUMN IF NOT EXISTS eta_time        TEXT,          -- HH:MM, worker-entered
  ADD COLUMN IF NOT EXISTS on_the_way_at  TIMESTAMPTZ;   -- auto-set on transition

-- ─── 3. worker_update_job_status — add on_the_way transitions ─────────────────

DROP FUNCTION IF EXISTS public.worker_update_job_status(UUID, TEXT);

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

  IF p_status NOT IN ('on_the_way','in_progress','completed','on_hold') THEN
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

  IF v_role NOT IN ('owner', 'manager') THEN
    IF v_assigned IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_assigned_to_this_job');
    END IF;
    IF NOT COALESCE((v_perms->>'can_create_job_reports')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
  END IF;

  -- Transition matrix
  IF NOT (
       (v_cur_status IN ('pending','confirmed') AND p_status = 'on_the_way')
    OR (v_cur_status IN ('pending','confirmed','on_the_way') AND p_status = 'in_progress')
    OR (v_cur_status = 'in_progress' AND p_status IN ('completed','on_hold'))
    OR (v_cur_status = 'on_hold'     AND p_status = 'in_progress')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition');
  END IF;

  UPDATE trade_jobs
  SET status         = p_status,
      on_the_way_at  = CASE
                         WHEN p_status = 'on_the_way' THEN now()
                         ELSE on_the_way_at
                       END,
      actual_start   = CASE
                         WHEN p_status = 'in_progress' AND actual_start IS NULL
                         THEN now()
                         ELSE actual_start
                       END,
      actual_end     = CASE
                         WHEN p_status = 'completed' AND actual_end IS NULL
                         THEN now()
                         ELSE actual_end
                       END,
      updated_at     = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_update_job_status(UUID, TEXT) TO authenticated;

-- ─── 4. update_trade_job_status — allow on_the_way for owner/manager ──────────

DROP FUNCTION IF EXISTS public.update_trade_job_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.update_trade_job_status(
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
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('pending','confirmed','on_the_way','in_progress','completed','on_hold') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner','manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_jobs
  SET status        = p_status,
      on_the_way_at = CASE WHEN p_status = 'on_the_way' THEN now() ELSE on_the_way_at END,
      actual_start  = CASE WHEN p_status = 'in_progress' AND actual_start IS NULL THEN now() ELSE actual_start END,
      actual_end    = CASE WHEN p_status = 'completed'   AND actual_end   IS NULL THEN now() ELSE actual_end   END,
      updated_at    = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_job_status(UUID, TEXT) TO authenticated;

-- ─── 5. update_trade_job_eta — worker or owner/manager sets ETA ───────────────

CREATE OR REPLACE FUNCTION public.update_trade_job_eta(
  p_job_id  UUID,
  p_eta_time TEXT   -- HH:MM or NULL to clear
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_biz_id   UUID;
  v_role     TEXT;
  v_assigned UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, assigned_to
    INTO v_biz_id, v_assigned
  FROM trade_jobs
  WHERE id = p_job_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager') AND v_assigned IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_assigned_to_this_job');
  END IF;

  UPDATE trade_jobs
  SET eta_time   = p_eta_time,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_job_eta(UUID, TEXT) TO authenticated;
