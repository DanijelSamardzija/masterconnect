-- Migration 025: Faza 6 — Emergency
--
-- Creates trade_emergency_requests table, Realtime support, and all
-- emergency management RPCs. All RPCs are SECURITY DEFINER with
-- SET search_path = public and enforce cross-tenant isolation.
--
-- Permissions:
--   can_accept_emergency — can view, create, accept, dispatch, etc.
--   can_handle_emergency — can be assigned/dispatched to an emergency
--   owner/manager role always implies both

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. trade_emergency_requests table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_emergency_requests (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID         NOT NULL REFERENCES public.booking_profiles(id) ON DELETE CASCADE,

  -- Contact: anonymous caller or linked trade_client
  client_id       UUID         REFERENCES public.trade_clients(id)  ON DELETE SET NULL,
  contact_name    TEXT,
  contact_phone   TEXT         NOT NULL,
  whatsapp        TEXT,
  viber           TEXT,

  -- Request details
  title           TEXT         NOT NULL,
  description     TEXT,
  address         TEXT,

  -- Status lifecycle (server-enforced state machine)
  status          TEXT         NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','in_transit','arrived','completed','cancelled')),

  -- ETA and timing
  eta_minutes     INT,
  accepted_at     TIMESTAMPTZ,
  dispatched_at   TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  -- Assignment
  assigned_to     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Link to auto-created trade_job (set atomically on accept)
  job_id          UUID         REFERENCES public.trade_jobs(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_emergency_requests_business_id_idx
  ON public.trade_emergency_requests (business_id);

CREATE INDEX IF NOT EXISTS trade_emergency_requests_status_idx
  ON public.trade_emergency_requests (business_id, status);

CREATE INDEX IF NOT EXISTS trade_emergency_requests_assigned_to_idx
  ON public.trade_emergency_requests (assigned_to)
  WHERE assigned_to IS NOT NULL;

ALTER TABLE public.trade_emergency_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_emergency_requests_staff_all ON public.trade_emergency_requests
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- updated_at trigger (reuse function from migration 021)
CREATE TRIGGER trade_emergency_requests_updated_at
  BEFORE UPDATE ON public.trade_emergency_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime support
ALTER TABLE public.trade_emergency_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_emergency_requests;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: resolve caller's role and emergency permissions for a business
-- (used inline in each RPC — not a separate function to keep definer chain clean)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. toggle_emergency_enabled
--    Owner/manager only. Updates booking_profiles.emergency_enabled.
--    Does NOT use upsert_trade_profile — changes only this one column.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_emergency_enabled(
  p_business_id UUID,
  p_enabled     BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
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

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE booking_profiles
  SET    emergency_enabled = p_enabled,
         updated_at        = now()
  WHERE  id = p_business_id;

  RETURN jsonb_build_object('ok', true, 'emergency_enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_emergency_enabled(UUID, BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. create_emergency_request
--    Owner/manager or can_accept_emergency.
--    Creates a new pending emergency request (manual / phone intake).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_emergency_request(
  p_business_id   UUID,
  p_title         TEXT,
  p_contact_phone TEXT,
  p_description   TEXT    DEFAULT NULL,
  p_contact_name  TEXT    DEFAULT NULL,
  p_address       TEXT    DEFAULT NULL,
  p_whatsapp      TEXT    DEFAULT NULL,
  p_viber         TEXT    DEFAULT NULL,
  p_client_id     UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_role       TEXT;
  v_perms      JSONB;
  v_can_accept BOOLEAN;
  v_new_id     UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;

  IF p_contact_phone IS NULL OR trim(p_contact_phone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contact_phone_required');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_accept := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_accept_emergency')::boolean, false);

  IF NOT v_can_accept THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Validate client_id belongs to this business if provided
  IF p_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_clients
      WHERE id = p_client_id AND business_id = p_business_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
    END IF;
  END IF;

  INSERT INTO trade_emergency_requests (
    business_id, client_id, contact_name, contact_phone,
    whatsapp, viber, title, description, address
  )
  VALUES (
    p_business_id, p_client_id, p_contact_name, trim(p_contact_phone),
    p_whatsapp, p_viber, trim(p_title), p_description, p_address
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_emergency_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. list_emergency_requests
--    Any active staff of the business.
--    Returns requests with assigned_name joined from profiles.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_emergency_requests(
  p_business_id UUID,
  p_status      TEXT    DEFAULT NULL,
  p_limit       INT     DEFAULT 100,
  p_offset      INT     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'requests', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',            er.id,
            'business_id',   er.business_id,
            'client_id',     er.client_id,
            'contact_name',  er.contact_name,
            'contact_phone', er.contact_phone,
            'whatsapp',      er.whatsapp,
            'viber',         er.viber,
            'title',         er.title,
            'description',   er.description,
            'address',       er.address,
            'status',        er.status,
            'eta_minutes',   er.eta_minutes,
            'accepted_at',   er.accepted_at,
            'dispatched_at', er.dispatched_at,
            'arrived_at',    er.arrived_at,
            'completed_at',  er.completed_at,
            'assigned_to',   er.assigned_to,
            'assigned_name', p.name,
            'job_id',        er.job_id,
            'created_at',    er.created_at,
            'updated_at',    er.updated_at
          )
          ORDER BY er.created_at DESC
        )
        FROM trade_emergency_requests er
        LEFT JOIN profiles p ON p.id = er.assigned_to
        WHERE er.business_id = p_business_id
          AND (p_status IS NULL OR er.status = p_status)
        LIMIT  p_limit
        OFFSET p_offset
      ),
      '[]'::jsonb
    ),
    'total', (
      SELECT COUNT(*)::int
      FROM trade_emergency_requests
      WHERE business_id = p_business_id
        AND (p_status IS NULL OR status = p_status)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_emergency_requests(UUID, TEXT, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. list_emergency_eligible_staff
--    Returns staff who can be assigned to handle an emergency.
--    Callable by: owner/manager OR can_accept_emergency.
--    Returns: staff with can_handle_emergency = true OR role IN (owner,manager).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_emergency_eligible_staff(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_role       TEXT;
  v_perms      JSONB;
  v_can_accept BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_accept := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_accept_emergency')::boolean, false);

  IF NOT v_can_accept THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', sm.user_id,
          'name',    p.name,
          'role',    sm.role
        )
        ORDER BY sm.role, p.name
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id = p_business_id
        AND sm.is_active   = true
        AND (
          sm.role IN ('owner','manager')
          OR COALESCE((sm.permissions->>'can_handle_emergency')::boolean, false) = true
        )
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_emergency_eligible_staff(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. accept_emergency_request
--    Owner/manager or can_accept_emergency.
--    ATOMIC: sets status=accepted + creates a pending trade_job + links job_id.
--    Uses SELECT ... FOR UPDATE to prevent double-accept race condition.
--    assigned_to must have can_handle_emergency or be owner/manager.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_emergency_request(
  p_request_id  UUID,
  p_assigned_to UUID    DEFAULT NULL,
  p_eta_minutes INT     DEFAULT NULL
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
  v_title      TEXT;
  v_desc       TEXT;
  v_address    TEXT;
  v_client_id  UUID;
  v_role       TEXT;
  v_perms      JSONB;
  v_can_accept BOOLEAN;
  v_new_job_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the row to prevent concurrent double-accepts
  SELECT business_id, status, title, description, address, client_id
  INTO   v_biz_id, v_cur_status, v_title, v_desc, v_address, v_client_id
  FROM   trade_emergency_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  IF v_cur_status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_pending');
  END IF;

  -- Verify caller is staff of this business
  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_accept := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_accept_emergency')::boolean, false);

  IF NOT v_can_accept THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Validate assigned_to: must have can_handle_emergency or be owner/manager
  IF p_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_members
      WHERE business_id = v_biz_id
        AND user_id     = p_assigned_to
        AND is_active   = true
        AND (
          role IN ('owner','manager')
          OR COALESCE((permissions->>'can_handle_emergency')::boolean, false) = true
        )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'assignee_not_eligible');
    END IF;
  END IF;

  -- ATOMIC: create trade_job first (so we have the job_id to link)
  INSERT INTO trade_jobs (
    business_id,
    title,
    description,
    origin_type,
    origin_id,
    assigned_to,
    status,
    priority,
    location,
    client_id,
    created_by
  )
  VALUES (
    v_biz_id,
    v_title,
    v_desc,
    'emergency',
    p_request_id,
    p_assigned_to,
    'pending',
    'urgent',
    v_address,
    v_client_id,
    v_uid
  )
  RETURNING id INTO v_new_job_id;

  -- ATOMIC: update emergency request with accepted status + job link
  UPDATE trade_emergency_requests
  SET    status      = 'accepted',
         assigned_to = p_assigned_to,
         eta_minutes = p_eta_minutes,
         accepted_at = now(),
         accepted_by = v_uid,
         job_id      = v_new_job_id
  WHERE  id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'job_id', v_new_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_emergency_request(UUID, UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. update_emergency_status
--    Server-enforced state machine — validates transition from current status.
--    Caller: owner/manager OR can_accept_emergency.
--    Terminal statuses (completed, cancelled) cannot be changed.
--    Transition matrix:
--      pending    → accepted | cancelled    (accept via accept_emergency_request)
--      accepted   → in_transit | cancelled
--      in_transit → arrived | cancelled
--      arrived    → completed | cancelled
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_emergency_status(
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
  v_cur_status TEXT;
  v_role       TEXT;
  v_perms      JSONB;
  v_can_accept BOOLEAN;
  v_ts_update  JSONB := '{}';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Note: 'accepted' is not allowed here — use accept_emergency_request instead
  IF p_status NOT IN ('in_transit','arrived','completed','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT business_id, status INTO v_biz_id, v_cur_status
  FROM   trade_emergency_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  -- Terminal statuses cannot be changed
  IF v_cur_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'terminal_status_cannot_change');
  END IF;

  -- Server-side state machine
  IF NOT (
       (v_cur_status = 'accepted'   AND p_status IN ('in_transit', 'cancelled'))
    OR (v_cur_status = 'in_transit' AND p_status IN ('arrived',    'cancelled'))
    OR (v_cur_status = 'arrived'    AND p_status IN ('completed',  'cancelled'))
    OR (v_cur_status = 'pending'    AND p_status = 'cancelled')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_accept := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_accept_emergency')::boolean, false);

  IF NOT v_can_accept THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_emergency_requests
  SET    status       = p_status,
         dispatched_at = CASE WHEN p_status = 'in_transit' THEN now() ELSE dispatched_at END,
         arrived_at   = CASE WHEN p_status = 'arrived'    THEN now() ELSE arrived_at    END,
         completed_at = CASE WHEN p_status = 'completed'  THEN now() ELSE completed_at  END
  WHERE  id = p_request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_emergency_status(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. update_emergency_eta
--    Owner/manager or can_accept_emergency.
--    Quick update of estimated arrival time during transit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_emergency_eta(
  p_request_id  UUID,
  p_eta_minutes INT
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
  v_perms      JSONB;
  v_can_accept BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, status INTO v_biz_id, v_cur_status
  FROM   trade_emergency_requests
  WHERE  id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  IF v_cur_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'terminal_status_cannot_change');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_accept := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_accept_emergency')::boolean, false);

  IF NOT v_can_accept THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_emergency_requests
  SET    eta_minutes = p_eta_minutes
  WHERE  id = p_request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_emergency_eta(UUID, INT) TO authenticated;
