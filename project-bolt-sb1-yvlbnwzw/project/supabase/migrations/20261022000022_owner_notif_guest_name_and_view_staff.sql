-- Two fixes:
-- 1. notify_booking_created: use guest_name as fallback when client_id is NULL
-- 2. get_booking_by_token: return staff_name so the guest view page can show it

-- ── 1. Fix notify_booking_created ────────────────────────────────────────────
-- When owner creates a booking for a guest (no client_id), v_client_name was NULL
-- because the trigger only queried profiles by client_id. Use guest_name as fallback.

CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_name   TEXT;
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_owner_uid     UUID;
  v_staff_uid     UUID;
  v_staff_role    TEXT;
  v_pref_key      TEXT;
  v_caller_uid    UUID;
  v_owner_created BOOL;
  v_staff_title   TEXT;
  v_staff_body    TEXT;
  v_meta          JSONB;
BEGIN
  v_caller_uid := auth.uid();

  SELECT name INTO v_client_name   FROM profiles        WHERE id = NEW.client_id   LIMIT 1;
  -- Fall back to guest_name when this is a guest booking (client_id IS NULL)
  IF v_client_name IS NULL THEN
    v_client_name := NEW.guest_name;
  END IF;

  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'client_id',     NEW.client_id,
    'client_name',   v_client_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- Resolve owner uid first (needed for owner_created check)
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  -- Was this booking created by the owner?
  v_owner_created := (v_caller_uid IS NOT NULL AND v_caller_uid = v_owner_uid);

  -- ── Notify assigned staff ──────────────────────────────────────────────────
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_uid IS NOT NULL
      AND (NEW.client_id IS NULL OR v_staff_uid <> NEW.client_id)
      AND (v_caller_uid IS NULL OR v_staff_uid <> v_caller_uid)
    THEN
      IF v_owner_created THEN
        v_staff_title := 'Vlasnik vam je zakazao termin';
        v_staff_body  := v_service_name || ' · ' || v_dt_str
          || CASE WHEN v_client_name IS NOT NULL
               THEN ' · Klijent: ' || v_client_name
               ELSE '' END;
      ELSE
        v_staff_title := COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin';
        v_staff_body  := v_service_name || ' · ' || v_dt_str;
      END IF;

      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        v_staff_title,
        v_staff_body,
        v_meta
      );
    END IF;
  END IF;

  -- ── Notify owner (skip if they created this booking) ──────────────────────
  IF v_owner_uid IS NOT NULL
    AND (NEW.client_id IS NULL OR v_owner_uid <> NEW.client_id)
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
    AND (v_caller_uid IS NULL OR v_owner_uid <> v_caller_uid)
  THEN
    IF v_staff_uid IS NOT NULL AND v_staff_uid <> v_owner_uid THEN
      v_pref_key := 'notify_staff_booking';
    ELSE
      v_pref_key := 'notify_new_booking';
    END IF;

    IF private_owner_pref(v_owner_uid, v_pref_key) THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_owner_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- ── Notify client of instant confirmation (skip guest and owner-created) ───
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL AND NOT v_owner_created THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id, 'booking', 'booking_confirmed',
      'Rezervacija potvrđena',
      COALESCE(v_business_name, 'Biznis') || ' je potvrdio/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  RETURN NEW;
END;
$$;


-- ── 2. Fix get_booking_by_token — add staff_name ──────────────────────────────
-- The original RPC intentionally excluded staff details. We now include staff_name
-- so the guest view page can display who will perform the service.

CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  SELECT jsonb_build_object(
    'booking_id',       b.id,
    'starts_at',        b.starts_at,
    'ends_at',          b.ends_at,
    'service_name',     b.service_name_snapshot,
    'status',           b.status,
    'guest_name',       b.guest_name,
    'notes',            b.notes,
    'business_name',    bp.name,
    'location_name',    bl.name,
    'location_address', bl.address,
    'location_city',    bl.city,
    'timezone',         COALESCE(bl.timezone, 'UTC'),
    'staff_name',       sp.name
  ) INTO v_row
  FROM   bookings b
  JOIN   booking_profiles bp ON bp.id = b.business_id
  LEFT JOIN business_locations bl ON bl.id = b.location_id
  LEFT JOIN staff_members sm ON sm.id = b.staff_member_id
  LEFT JOIN profiles sp ON sp.id = sm.user_id
  WHERE  b.guest_access_token = p_token
    AND  b.guest_email IS NOT NULL
    AND  (b.guest_token_expires_at IS NULL OR b.guest_token_expires_at > now())
  LIMIT  1;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking', v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;
