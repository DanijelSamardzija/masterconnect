-- Fix permission JSONB clobbering between booking and trade namespaces.
--
-- Bug 1: update_staff_permissions omitted can_complete_bookings from its
--        whitelist (regression in migration 20261022000001), so the toggle
--        appeared to save but was silently reset to false on every save.
--
-- Bug 3: update_staff_permissions did a full overwrite of permissions with
--        only the 6 booking keys, silently deleting all 9 trade keys.
--
-- Fix for both: use a targeted merge — remove only the 6 booking keys from
-- the existing JSONB, then || (concatenate) the new booking values. All trade
-- keys (and any future keys we haven't thought of yet) are preserved untouched.
--
-- Bug 2: update_trade_staff_permissions preserved only the original 4 booking
--        keys, silently dropping can_reschedule_bookings and can_complete_bookings
--        when trade permissions were saved after those keys were added.
--
-- Fix: use the same targeted merge — remove only the 9 trade keys from the
-- existing JSONB, then || the new trade values. All booking keys are preserved.

-- ── 1. update_staff_permissions (booking keys) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.update_staff_permissions(
  p_staff_member_id UUID,
  p_permissions     JSONB
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

  SELECT business_id INTO v_biz_id
  FROM staff_members
  WHERE id = p_staff_member_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  IF v_uid = v_biz_id THEN
    v_role := 'owner';
  ELSE
    SELECT role INTO v_role
    FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
    LIMIT 1;
  END IF;

  IF v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Targeted merge: strip only the 6 booking keys we own, then add new values.
  -- Any trade keys (or other unknown keys) in the existing JSONB are preserved.
  UPDATE staff_members
  SET permissions = (
        permissions
        - ARRAY[
            'can_set_hours',
            'can_create_bookings',
            'can_cancel_bookings',
            'can_block_time',
            'can_reschedule_bookings',
            'can_complete_bookings'
          ]
      ) || jsonb_build_object(
        'can_set_hours',           COALESCE((p_permissions->>'can_set_hours')::boolean,           false),
        'can_create_bookings',     COALESCE((p_permissions->>'can_create_bookings')::boolean,     false),
        'can_cancel_bookings',     COALESCE((p_permissions->>'can_cancel_bookings')::boolean,     false),
        'can_block_time',          COALESCE((p_permissions->>'can_block_time')::boolean,          false),
        'can_reschedule_bookings', COALESCE((p_permissions->>'can_reschedule_bookings')::boolean, false),
        'can_complete_bookings',   COALESCE((p_permissions->>'can_complete_bookings')::boolean,   false)
      ),
      updated_at = now()
  WHERE id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_permissions(UUID, JSONB) TO authenticated;


-- ── 2. update_trade_staff_permissions (trade keys) ───────────────────────────

CREATE OR REPLACE FUNCTION public.update_trade_staff_permissions(
  p_business_id UUID,
  p_staff_id    UUID,
  p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_id AND business_id = p_business_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Targeted merge: strip only the 9 trade keys we own, then add new values.
  -- All booking keys (can_set_hours, can_create_bookings, can_cancel_bookings,
  -- can_block_time, can_reschedule_bookings, can_complete_bookings — current and
  -- any future ones) remain in the JSONB untouched.
  UPDATE staff_members
  SET permissions = (
        permissions
        - ARRAY[
            'can_create_manual_jobs',
            'can_view_client_records',
            'can_edit_client_records',
            'can_create_job_reports',
            'can_add_materials',
            'can_view_financials',
            'can_view_purchase_prices',
            'can_handle_emergency',
            'can_accept_emergency'
          ]
      ) || jsonb_build_object(
        'can_create_manual_jobs',   COALESCE((p_permissions->>'can_create_manual_jobs')::boolean,   false),
        'can_view_client_records',  COALESCE((p_permissions->>'can_view_client_records')::boolean,  false),
        'can_edit_client_records',  COALESCE((p_permissions->>'can_edit_client_records')::boolean,  false),
        'can_create_job_reports',   COALESCE((p_permissions->>'can_create_job_reports')::boolean,   false),
        'can_add_materials',        COALESCE((p_permissions->>'can_add_materials')::boolean,        false),
        'can_view_financials',      COALESCE((p_permissions->>'can_view_financials')::boolean,      false),
        'can_view_purchase_prices', COALESCE((p_permissions->>'can_view_purchase_prices')::boolean, false),
        'can_handle_emergency',     COALESCE((p_permissions->>'can_handle_emergency')::boolean,     false),
        'can_accept_emergency',     COALESCE((p_permissions->>'can_accept_emergency')::boolean,     false)
      ),
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_staff_permissions(UUID, UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
