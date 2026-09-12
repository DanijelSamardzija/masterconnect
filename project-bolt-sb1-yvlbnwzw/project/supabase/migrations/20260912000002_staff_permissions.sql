-- Staff permissions system.
-- Adds a permissions JSONB column to staff_members and RPCs to manage them.
--
-- Permission keys:
--   can_set_hours        — radnik može mijenjati vlastite smjene i pauze
--   can_create_bookings  — radnik može ručno zakazati termin (telefon)
--   can_cancel_bookings  — radnik može otkazati svoju rezervaciju
--   can_block_time       — radnik može blokirati sebi vrijme (godišnji, bolovanje)

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}';

-- ==========================================================================
-- RPC: update_staff_permissions
-- Owner/manager updates permissions for one of their staff members.
-- ==========================================================================

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

  -- Caller must be owner (business_id = v_uid) or manager of the same business
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

  -- Only allow known permission keys to prevent arbitrary data injection
  p_permissions := jsonb_build_object(
    'can_set_hours',       COALESCE((p_permissions->>'can_set_hours')::boolean,       false),
    'can_create_bookings', COALESCE((p_permissions->>'can_create_bookings')::boolean, false),
    'can_cancel_bookings', COALESCE((p_permissions->>'can_cancel_bookings')::boolean, false),
    'can_block_time',      COALESCE((p_permissions->>'can_block_time')::boolean,      false)
  );

  UPDATE staff_members
  SET permissions = p_permissions, updated_at = now()
  WHERE id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_permissions(UUID, JSONB) TO authenticated;
