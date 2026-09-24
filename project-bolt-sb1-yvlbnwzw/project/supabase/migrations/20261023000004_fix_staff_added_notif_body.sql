-- Fix: notification body sent to newly added staff member said "sekciji Osoblje"
-- which is the owner-side UI label. The worker has no "Osoblje" section.
-- Changed to "radničkom dashboardu" so the text makes sense from the worker's view.

CREATE OR REPLACE FUNCTION public.add_staff_direct(
  p_user_id     UUID,
  p_role        TEXT DEFAULT 'worker',
  p_location_id UUID DEFAULT NULL,
  p_business_id UUID DEFAULT NULL
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
  v_owner_name TEXT;
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

  -- Resolve which booking profile to add staff to
  IF p_business_id IS NULL THEN
    v_biz_id := v_uid;
  ELSE
    PERFORM 1 FROM staff_members
    WHERE  business_id = p_business_id
      AND  user_id     = v_uid
      AND  is_active   = true
      AND  role        IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_biz_id := p_business_id;
  END IF;

  INSERT INTO staff_members (business_id, user_id, role, primary_location_id, is_active)
  VALUES (v_biz_id, p_user_id, p_role, p_location_id, true)
  ON CONFLICT (business_id, user_id)
    DO UPDATE SET
      is_active           = true,
      role                = EXCLUDED.role,
      primary_location_id = EXCLUDED.primary_location_id,
      updated_at          = now();

  SELECT name INTO v_owner_name FROM profiles WHERE id = v_uid;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    p_user_id,
    'staff_added',
    'staff_added',
    v_owner_name || ' te je dodao/la u tim',
    'Dodat/a si kao radnik. Možeš pregledati raspored rezervacija na radničkom dashboardu.',
    jsonb_build_object(
      'owner_id',    v_uid,
      'owner_name',  v_owner_name,
      'business_id', v_biz_id,
      'role',        p_role
    )
  );

  RETURN jsonb_build_object('ok', true, 'owner_name', v_owner_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_staff_direct(UUID, TEXT, UUID, UUID) TO authenticated;
