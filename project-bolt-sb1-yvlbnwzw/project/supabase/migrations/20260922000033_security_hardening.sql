-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 033: Security Hardening — P0/P1/P2/P3
-- Covers: notifications open INSERT, list_my_trade_jobs client data, REVOKE gaps,
--         guest INSERT validation, opening_hours/time_blocks public access,
--         can_review_business owner_id fix, link_trade_client consent notification.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- P0-C2: notifications — remove open authenticated INSERT; add guarded RPC
-- ═══════════════════════════════════════════════════════════════════════════════
-- All SECURITY DEFINER trigger functions (notify_post_reaction, notify_post_comment,
-- create_message_notification, etc.) bypass RLS and do not need this policy.
-- App-layer inserts must go through send_notification() which enforces a whitelist.

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id     UUID,
  p_type        TEXT,
  p_action_type TEXT,
  p_title       TEXT,
  p_body        TEXT,
  p_meta        JSONB DEFAULT '{}',
  p_post_id     UUID DEFAULT NULL
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

  IF p_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_notify_self');
  END IF;

  IF p_action_type NOT IN (
    'application_received', 'inquiry_received', 'inquiry_accepted', 'inquiry_declined'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action_type');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  INSERT INTO public.notifications (user_id, type, action_type, title, body, meta, post_id)
  VALUES (p_user_id, p_type, p_action_type, p_title, p_body, COALESCE(p_meta, '{}'), p_post_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- P1-H1: list_my_trade_jobs — enforce can_view_client_records server-side
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_my_trade_jobs(
  p_business_id UUID,
  p_status      TEXT  DEFAULT NULL,
  p_limit       INT   DEFAULT 50,
  p_offset      INT   DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID;
  v_role            TEXT;
  v_perms           JSONB;
  v_can_view_client BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
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

  v_can_view_client := v_role IN ('owner', 'manager')
    OR COALESCE((v_perms->>'can_view_client_records')::boolean, false);

  RETURN jsonb_build_object(
    'ok',   true,
    'jobs', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',              j.id,
            'title',           j.title,
            'description',     j.description,
            'status',          j.status,
            'priority',        j.priority,
            'origin_type',     j.origin_type,
            'location',        j.location,
            'scheduled_start', j.scheduled_start,
            'scheduled_end',   j.scheduled_end,
            'actual_start',    j.actual_start,
            'actual_end',      j.actual_end,
            'job_id',          j.id,
            'client_name',     CASE WHEN v_can_view_client THEN tc.name  ELSE NULL END,
            'client_phone',    CASE WHEN v_can_view_client THEN tc.phone ELSE NULL END,
            'created_at',      j.created_at,
            'updated_at',      j.updated_at
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
        WHERE j.business_id = p_business_id
          AND j.assigned_to = v_uid
          AND (p_status IS NULL OR j.status = p_status)
        LIMIT  p_limit
        OFFSET p_offset
      ),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_trade_jobs(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_my_trade_jobs(UUID, TEXT, INT, INT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- P1-H2: REVOKE EXECUTE FROM PUBLIC, anon for migrations 019–026 + 032 gap
-- All these functions already have GRANT TO authenticated; REVOKE closes the
-- implicit PUBLIC execute that PostgreSQL grants at function creation time.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Migration 019/027: 6-param version was replaced by 8-param in migration 027
REVOKE EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID, TEXT, TEXT[]) FROM PUBLIC, anon;

-- Migration 020
REVOKE EXECUTE ON FUNCTION public.check_trade_business_access(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_trade_client(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_trade_client(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_trade_client(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_trade_clients(UUID, TEXT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trade_client(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trade_client_history(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_trade_asset(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_trade_asset(UUID) FROM PUBLIC, anon;

-- Migration 022
REVOKE EXECUTE ON FUNCTION public.get_trade_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_trade_staff_permissions(UUID, UUID, JSONB) FROM PUBLIC, anon;

-- Migration 023
REVOKE EXECUTE ON FUNCTION public.create_trade_job(UUID,TEXT,TEXT,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_trade_job(UUID,TEXT,TEXT,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_trade_job_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_trade_job(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trade_job(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_trade_jobs(UUID,TEXT,UUID,INT,INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_trade_material(UUID,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_trade_material(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_trade_expense(UUID,TEXT,TEXT,NUMERIC,TEXT,UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_trade_expense(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_trade_photo(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_trade_photo(UUID) FROM PUBLIC, anon;

-- Migration 025
REVOKE EXECUTE ON FUNCTION public.toggle_emergency_enabled(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_emergency_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_emergency_requests(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_emergency_eligible_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_emergency_request(UUID, UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_emergency_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_emergency_eta(UUID, INT) FROM PUBLIC, anon;

-- Migration 026
REVOKE EXECUTE ON FUNCTION public.worker_update_job_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.worker_update_emergency_status(UUID, TEXT) FROM PUBLIC, anon;

-- Migration 032 gap: get_trade_client was redefined in 032 without REVOKE
REVOKE EXECUTE ON FUNCTION public.get_trade_client(UUID) FROM PUBLIC, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- P2-M1: Strengthen public INSERT policies — validate against active businesses
-- Prevents spam submissions to non-existent or inactive businesses.
-- Guest flow remains intact; only active business_ids are accepted.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "treq_public_insert" ON public.tradesperson_requests;
CREATE POLICY "treq_public_insert" ON public.tradesperson_requests
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.booking_profiles WHERE is_active = true)
  );

DROP POLICY IF EXISTS "fo_public_insert" ON public.food_orders;
CREATE POLICY "fo_public_insert" ON public.food_orders
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.booking_profiles WHERE is_active = true)
  );

DROP POLICY IF EXISTS "tr_public_insert" ON public.table_reservations;
CREATE POLICY "tr_public_insert" ON public.table_reservations
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.booking_profiles WHERE is_active = true)
  );

DROP POLICY IF EXISTS "ab_public_insert" ON public.accommodation_bookings;
CREATE POLICY "ab_public_insert" ON public.accommodation_bookings
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.booking_profiles WHERE is_active = true)
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- P2-M2: opening_hours + time_blocks — restrict public read to business-level rows
-- Staff schedule rows (staff_member_id IS NOT NULL) are now staff-only.
-- Availability RPCs (get_available_slots etc.) are SECURITY DEFINER and bypass
-- RLS, so booking availability is not affected by this restriction.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public read opening hours" ON public.opening_hours;

-- Public sees only business-level opening hours (no staff overrides/schedules)
CREATE POLICY "Public read business opening hours" ON public.opening_hours
  FOR SELECT USING (staff_member_id IS NULL);

-- Authenticated staff see all opening hours for their own businesses (via location_id)
CREATE POLICY "Staff read own business opening hours" ON public.opening_hours
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.business_locations
      WHERE business_id IN (SELECT public.get_my_business_ids())
    )
  );

DROP POLICY IF EXISTS "Public read time blocks" ON public.time_blocks;

-- Public sees only business-level time blocks (no staff absence/override blocks)
CREATE POLICY "Public read business time blocks" ON public.time_blocks
  FOR SELECT USING (staff_member_id IS NULL);

-- Authenticated staff see all time blocks for their own businesses (via location_id)
CREATE POLICY "Staff read own business time blocks" ON public.time_blocks
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.business_locations
      WHERE business_id IN (SELECT public.get_my_business_ids())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- P2-M3: can_review_business — use booking_profiles.owner_id for thread check
-- booking_profiles.id != owner_id for secondary profiles; threads link user UUIDs,
-- not business profile UUIDs, so the check must use the owner's user_id.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_review_business(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID := auth.uid();
  v_already_reviewed BOOLEAN;
  v_has_contact      BOOLEAN;
  v_owner_id         UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'can_review', false, 'already_reviewed', false, 'reason', 'not_authenticated'
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM reviews
    WHERE customer_id = v_user_id AND pro_id = p_business_id
  ) INTO v_already_reviewed;

  IF v_already_reviewed THEN
    RETURN jsonb_build_object('ok', true, 'can_review', false, 'already_reviewed', true);
  END IF;

  -- Contact check a: completed trade_job where this user was the client
  SELECT EXISTS(
    SELECT 1 FROM trade_jobs
    WHERE business_id = p_business_id
      AND client_id   = v_user_id
      AND status      = 'completed'
    LIMIT 1
  ) INTO v_has_contact;

  -- Contact check b: messages thread with the business OWNER (not business profile ID)
  IF NOT v_has_contact THEN
    SELECT owner_id INTO v_owner_id
    FROM booking_profiles
    WHERE id = p_business_id
    LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM threads
        WHERE (user1_id = v_user_id AND user2_id = v_owner_id)
           OR (user1_id = v_owner_id AND user2_id = v_user_id)
        LIMIT 1
      ) INTO v_has_contact;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'can_review', v_has_contact, 'already_reviewed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_business(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_business(UUID) TO   authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- P3-L1: link_trade_client_to_user — notify target user when their record is linked
-- Consent signal: user learns a business has stored their data in CRM.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.link_trade_client_to_user(
  p_client_id UUID,
  p_email     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_target_uid  UUID;
  v_biz_name    TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_clients WHERE id = p_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT id INTO v_target_uid
  FROM profiles WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  SELECT name INTO v_biz_name
  FROM booking_profiles WHERE id = v_biz_id LIMIT 1;

  UPDATE trade_clients
  SET linked_user_id = v_target_uid
  WHERE id = p_client_id;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    v_target_uid,
    'system',
    'client_linked',
    COALESCE(v_biz_name, 'Firma') || ' vas je dodala kao klijenta',
    'Vaše informacije su sačuvane u CRM sistemu firme. Kontaktirajte firmu ili GigZone podršku za zahtjeve za uklanjanje.',
    jsonb_build_object('business_id', v_biz_id, 'client_id', p_client_id, 'biz_name', v_biz_name)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_trade_client_to_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.link_trade_client_to_user(UUID, TEXT) TO   authenticated;
