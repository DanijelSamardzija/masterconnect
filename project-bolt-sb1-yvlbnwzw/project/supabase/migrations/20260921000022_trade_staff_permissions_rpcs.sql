-- Migration 022: Trade staff permission RPCs.
--
-- get_trade_staff          — like get_my_staff but adds permissions JSONB
-- update_trade_staff_permissions — sets trade-specific keys while preserving
--                                  existing booking permission keys

-- ── get_trade_staff ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_staff(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           sm.id,
          'user_id',      sm.user_id,
          'name',         p.name,
          'email',        p.email,
          'avatar_url',   p.avatar_url,
          'role',         sm.role,
          'is_active',    sm.is_active,
          'permissions',  sm.permissions,
          'joined_at',    sm.joined_at
        )
        ORDER BY sm.joined_at
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id = p_business_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_staff(UUID) TO authenticated;

-- ── update_trade_staff_permissions ────────────────────────────────────────────
-- Whitelists only the 9 trade-specific permission keys.
-- Booking keys (can_set_hours / can_create_bookings / can_cancel_bookings /
-- can_block_time) are read from the current DB row and preserved unchanged.
-- This prevents the two permission RPCs from clobbering each other.

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
  v_current     JSONB;
  v_new_perms   JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Caller must be owner or manager of this business
  SELECT role INTO v_caller_role
  FROM staff_members
  WHERE business_id = p_business_id
    AND user_id     = v_uid
    AND is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Target staff member must belong to the same business
  SELECT permissions INTO v_current
  FROM staff_members
  WHERE id          = p_staff_id
    AND business_id = p_business_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Merge: booking keys preserved from DB, trade keys replaced from input
  v_new_perms := jsonb_build_object(
    -- Booking permission keys — owned by update_staff_permissions, never touched here
    'can_set_hours',            COALESCE((v_current->>'can_set_hours')::boolean,            false),
    'can_create_bookings',      COALESCE((v_current->>'can_create_bookings')::boolean,      false),
    'can_cancel_bookings',      COALESCE((v_current->>'can_cancel_bookings')::boolean,      false),
    'can_block_time',           COALESCE((v_current->>'can_block_time')::boolean,           false),
    -- Trade permission keys — set from caller's input (whitelist enforced by exclusion)
    'can_create_manual_jobs',   COALESCE((p_permissions->>'can_create_manual_jobs')::boolean,   false),
    'can_view_client_records',  COALESCE((p_permissions->>'can_view_client_records')::boolean,  false),
    'can_edit_client_records',  COALESCE((p_permissions->>'can_edit_client_records')::boolean,  false),
    'can_create_job_reports',   COALESCE((p_permissions->>'can_create_job_reports')::boolean,   false),
    'can_add_materials',        COALESCE((p_permissions->>'can_add_materials')::boolean,        false),
    'can_view_financials',      COALESCE((p_permissions->>'can_view_financials')::boolean,      false),
    'can_view_purchase_prices', COALESCE((p_permissions->>'can_view_purchase_prices')::boolean, false),
    'can_handle_emergency',     COALESCE((p_permissions->>'can_handle_emergency')::boolean,     false),
    'can_accept_emergency',     COALESCE((p_permissions->>'can_accept_emergency')::boolean,     false)
  );

  UPDATE staff_members
  SET permissions = v_new_perms,
      updated_at  = now()
  WHERE id = p_staff_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_staff_permissions(UUID, UUID, JSONB) TO authenticated;
