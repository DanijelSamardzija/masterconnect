-- add_staff_direct
-- Add a GigZone user directly as staff (no email invitation flow).
-- The caller (auth.uid()) is the business owner.
-- Reactivates and updates role/location if the user was previously removed.

CREATE OR REPLACE FUNCTION public.add_staff_direct(
  p_user_id     UUID,
  p_role        TEXT DEFAULT 'worker',
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id_required');
  END IF;

  IF p_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_add_yourself');
  END IF;

  IF p_role NOT IN ('manager', 'worker') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  INSERT INTO staff_members (business_id, user_id, role, primary_location_id, is_active)
  VALUES (v_uid, p_user_id, p_role, p_location_id, true)
  ON CONFLICT (business_id, user_id)
    DO UPDATE SET
      is_active           = true,
      role                = EXCLUDED.role,
      primary_location_id = EXCLUDED.primary_location_id,
      updated_at          = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_staff_direct(UUID, TEXT, UUID) TO authenticated;
