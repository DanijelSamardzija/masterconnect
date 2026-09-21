-- Migration 024: Add RPC-level guard to update_trade_job_status
-- Cancelled jobs cannot be reactivated via update_trade_job_status.
-- cancel_trade_job remains the only way to set status = 'cancelled'.

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
  v_uid        UUID;
  v_biz_id     UUID;
  v_cur_status TEXT;
  v_role       TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('pending','confirmed','in_progress','completed','on_hold') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT business_id, status INTO v_biz_id, v_cur_status
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  -- Hard guard: cancelled jobs cannot be reactivated through this RPC.
  -- Use a dedicated reinstate RPC if that business logic is ever needed.
  IF v_cur_status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cancelled_job_cannot_be_reactivated');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner','manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_jobs SET status = p_status WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_job_status(UUID, TEXT) TO authenticated;
