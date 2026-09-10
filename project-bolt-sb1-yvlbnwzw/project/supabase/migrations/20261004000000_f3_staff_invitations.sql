-- ==========================================================================
-- F3: Staff Invitations — send / accept / cancel / revoke
-- Table + RLS + indexes all in F0. This file contains only the RPCs.
-- No UI in this phase → no i18n keys added here.
-- ==========================================================================
--
-- INVITATION LIFECYCLE
--   pending → accepted   (via accept_staff_invitation)
--   pending → cancelled  (via cancel_staff_invitation by owner/manager)
--   pending → expired    (inline check in accept; cron in future)
--
-- AUTHORIZATION HIERARCHY
--   Owner  : can send (role=manager|worker), cancel, revoke manager|worker
--   Manager: can send (role=worker only), cancel, revoke worker only
--   Worker : no write access to invitations or staff membership
--
-- ADVISORY LOCK
--   accept_staff_invitation acquires lock on token before checking status
--   to prevent two concurrent accepts from creating duplicate staff_members rows.
--   Namespace: hashtext('bk:si') — consistent with F2 lock namespace convention.
--
-- RPC CONTRACTS
-- ─────────────────────────────────────────────────────────────────────────
--
-- send_staff_invitation(p_business_id, p_email, p_role, p_location_id?)
--   Returns: { ok, invitation_id, token, expires_at }
--   Errors:  not_authenticated | not_authorized | business_not_found |
--            invalid_role | invalid_email | already_staff |
--            invitation_already_pending
--
-- accept_staff_invitation(p_token)
--   Returns: { ok, staff_member_id, business_id, role }
--   Errors:  not_authenticated | token_not_found | token_expired |
--            token_already_used | email_mismatch | already_staff
--
-- cancel_staff_invitation(p_invitation_id)
--   Returns: { ok, invitation_id }
--   Errors:  not_authenticated | invitation_not_found | not_authorized |
--            already_accepted | already_cancelled
--
-- revoke_staff_member(p_staff_member_id)
--   Returns: { ok, staff_member_id }
--   Errors:  not_authenticated | staff_member_not_found | not_authorized |
--            cannot_revoke_self | already_inactive
-- ==========================================================================

-- ── send_staff_invitation ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_staff_invitation(
  p_business_id UUID,
  p_email       TEXT,
  p_role        TEXT,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_inv_id      UUID;
  v_token       TEXT;
  v_expires_at  TIMESTAMPTZ;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Input validation
  IF p_role NOT IN ('manager', 'worker') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  -- 3. Business exists
  PERFORM id FROM profiles
  WHERE id = p_business_id AND is_business = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  -- 4. Caller authorization: must be active owner or manager of this business
  SELECT sm.role INTO v_caller_role
  FROM staff_members sm
  WHERE sm.business_id = p_business_id
    AND sm.user_id     = v_caller_id
    AND sm.is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Manager can only invite workers (not other managers)
  IF v_caller_role = 'manager' AND p_role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 5. Optional location must belong to this business
  IF p_location_id IS NOT NULL THEN
    PERFORM id FROM business_locations
    WHERE id = p_location_id AND business_id = p_business_id AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
    END IF;
  END IF;

  -- 6. Invitee not already active staff (check via profiles.email + staff_members)
  IF EXISTS (
    SELECT 1
    FROM   staff_members sm
    JOIN   profiles p ON p.id = sm.user_id
    WHERE  sm.business_id = p_business_id
      AND  sm.is_active   = true
      AND  lower(p.email) = lower(p_email)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_staff');
  END IF;

  -- Also check via auth.users for users whose profile email may be stale
  IF EXISTS (
    SELECT 1
    FROM   staff_members sm
    JOIN   auth.users au ON au.id = sm.user_id
    WHERE  sm.business_id = p_business_id
      AND  sm.is_active   = true
      AND  lower(au.email) = lower(p_email)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_staff');
  END IF;

  -- 7. No pending invitation for this email + business already exists
  IF EXISTS (
    SELECT 1 FROM staff_invitations
    WHERE  business_id = p_business_id
      AND  lower(email) = lower(p_email)
      AND  status = 'pending'
      AND  expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_already_pending');
  END IF;

  -- 8. Create invitation
  v_token      := gen_random_uuid()::TEXT;
  v_expires_at := now() + INTERVAL '7 days';

  INSERT INTO staff_invitations (
    business_id, inviter_id, email, role, location_id,
    token, status, expires_at
  ) VALUES (
    p_business_id, v_caller_id, lower(p_email), p_role, p_location_id,
    v_token, 'pending', v_expires_at
  )
  RETURNING id INTO v_inv_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'invitation_id', v_inv_id,
    'token',         v_token,
    'expires_at',    v_expires_at
  );
END;
$$;

-- ── accept_staff_invitation ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    UUID;
  v_caller_email TEXT;
  v_inv          RECORD;
  v_sm_id        UUID;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Caller's email (authoritative source: auth.users)
  SELECT lower(email) INTO v_caller_email
  FROM   auth.users
  WHERE  id = v_caller_id
  LIMIT  1;

  -- 3. Advisory lock on token — prevents duplicate accepts under parallel load
  PERFORM pg_advisory_xact_lock(
    hashtext('bk:si'),
    hashtext(p_token)
  );

  -- 4. Load invitation (re-read after lock)
  SELECT id, business_id, email, role, location_id, status, expires_at
  INTO   v_inv
  FROM   staff_invitations
  WHERE  token = p_token
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;

  -- 5. Status checks
  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_already_used');
  END IF;

  IF v_inv.expires_at <= now() THEN
    -- Mark expired inline (best-effort, non-fatal if it fails)
    UPDATE staff_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
  END IF;

  -- 6. Email match
  IF lower(v_inv.email) <> v_caller_email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  -- 7. Not already an active staff member at this business
  IF EXISTS (
    SELECT 1 FROM staff_members
    WHERE  business_id = v_inv.business_id
      AND  user_id     = v_caller_id
      AND  is_active   = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_staff');
  END IF;

  -- 8. Create staff membership
  -- Use ON CONFLICT to handle the edge case of a reactivation (inactive member
  -- accepting a new invite): update is_active + role instead of erroring.
  INSERT INTO staff_members (
    business_id, user_id, role, primary_location_id, is_active
  ) VALUES (
    v_inv.business_id, v_caller_id, v_inv.role, v_inv.location_id, true
  )
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET
    role                = EXCLUDED.role,
    primary_location_id = EXCLUDED.primary_location_id,
    is_active           = true,
    updated_at          = now()
  RETURNING id INTO v_sm_id;

  -- 9. Mark invitation accepted
  UPDATE staff_invitations
  SET    status      = 'accepted',
         accepted_at = now()
  WHERE  id = v_inv.id;

  RETURN jsonb_build_object(
    'ok',             true,
    'staff_member_id', v_sm_id,
    'business_id',    v_inv.business_id,
    'role',           v_inv.role
  );
END;
$$;

-- ── cancel_staff_invitation ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_staff_invitation(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_inv         RECORD;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Load invitation
  SELECT id, business_id, status
  INTO   v_inv
  FROM   staff_invitations
  WHERE  id = p_invitation_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  END IF;

  -- 3. Authorization: must be owner or manager of the business
  SELECT sm.role INTO v_caller_role
  FROM   staff_members sm
  WHERE  sm.business_id = v_inv.business_id
    AND  sm.user_id     = v_caller_id
    AND  sm.is_active   = true
  LIMIT  1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 4. Status check
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_cancelled');
  END IF;

  -- 5. Cancel
  UPDATE staff_invitations
  SET    status = 'cancelled'
  WHERE  id = p_invitation_id;

  RETURN jsonb_build_object('ok', true, 'invitation_id', p_invitation_id);
END;
$$;

-- ── revoke_staff_member ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_staff_member(
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_target      RECORD;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Load target staff member
  SELECT id, business_id, user_id, role, is_active
  INTO   v_target
  FROM   staff_members
  WHERE  id = p_staff_member_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_member_not_found');
  END IF;

  -- 3. Cannot revoke self
  IF v_target.user_id = v_caller_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_revoke_self');
  END IF;

  -- 4. Already inactive
  IF NOT v_target.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_inactive');
  END IF;

  -- 5. Caller must be owner or manager of that business
  SELECT sm.role INTO v_caller_role
  FROM   staff_members sm
  WHERE  sm.business_id = v_target.business_id
    AND  sm.user_id     = v_caller_id
    AND  sm.is_active   = true
  LIMIT  1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 6. Authorization hierarchy:
  --    Owner can revoke manager or worker.
  --    Manager can only revoke worker (not manager or owner).
  --    Nobody can revoke an owner via this function (requires ownership transfer).
  IF v_target.role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_caller_role = 'manager' AND v_target.role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- 7. Soft-revoke: set is_active = false (preserves history for bookings etc.)
  UPDATE staff_members
  SET    is_active   = false,
         updated_at  = now()
  WHERE  id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true, 'staff_member_id', p_staff_member_id);
END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────
-- All four functions require authentication.
-- Token-based accept requires auth (user must be logged in to claim membership).

REVOKE ALL ON FUNCTION public.send_staff_invitation(UUID, TEXT, TEXT, UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_staff_invitation(TEXT)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_staff_invitation(UUID)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_staff_member(UUID)                        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.send_staff_invitation(UUID, TEXT, TEXT, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_staff_invitation(UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_member(UUID)                       TO authenticated;
