-- notify_booking_created: detect staff-created booking (non-owner staff adds booking
-- via their dashboard) and send a different title to owner with new pref key.
-- Also update update_notification_prefs to include the two new keys.

-- ── 1. notify_booking_created ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_name    TEXT;
  v_business_name  TEXT;
  v_service_name   TEXT;
  v_dt_str         TEXT;
  v_owner_uid      UUID;
  v_staff_uid      UUID;
  v_staff_role     TEXT;
  v_staff_name     TEXT;
  v_caller_uid     UUID;
  v_owner_created  BOOL;
  v_staff_created  BOOL;
  v_pref_key       TEXT;
  v_staff_title    TEXT;
  v_staff_body     TEXT;
  v_meta           JSONB;
BEGIN
  v_caller_uid := auth.uid();

  SELECT name INTO v_client_name FROM profiles WHERE id = NEW.client_id LIMIT 1;
  IF v_client_name IS NULL THEN
    v_client_name := NEW.guest_name;
  END IF;

  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  -- Resolve owner uid
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  -- Resolve caller staff name (needed for staff_created path)
  IF v_caller_uid IS NOT NULL AND v_caller_uid <> v_owner_uid THEN
    SELECT p.name INTO v_staff_name
    FROM profiles p WHERE p.id = v_caller_uid LIMIT 1;
  END IF;

  v_owner_created := (v_caller_uid IS NOT NULL AND v_caller_uid = v_owner_uid);
  -- staff_created: caller is an active non-owner staff member of this business
  v_staff_created := (
    v_caller_uid IS NOT NULL
    AND v_caller_uid <> v_owner_uid
    AND EXISTS (
      SELECT 1 FROM staff_members sm2
      WHERE sm2.user_id = v_caller_uid
        AND sm2.business_id = NEW.business_id
        AND sm2.is_active = true
    )
  );

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
          || CASE WHEN v_client_name IS NOT NULL THEN ' · Klijent: ' || v_client_name ELSE '' END;
      ELSE
        v_staff_title := COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin';
        v_staff_body  := v_service_name || ' · ' || v_dt_str;
      END IF;

      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (v_staff_uid, 'booking', 'booking_created', v_staff_title, v_staff_body, v_meta);
    END IF;
  END IF;

  -- ── Notify owner ───────────────────────────────────────────────────────────
  IF v_owner_uid IS NOT NULL
    AND (NEW.client_id IS NULL OR v_owner_uid <> NEW.client_id)
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
    AND (v_caller_uid IS NULL OR v_owner_uid <> v_caller_uid)
  THEN
    IF v_staff_created THEN
      -- Staff member added booking via their dashboard
      IF private_owner_pref(v_owner_uid, 'notify_staff_added_booking') THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_owner_uid, 'booking', 'booking_created',
          COALESCE(v_staff_name, 'Radnik') || ' je dodao/la termin',
          v_service_name || ' · ' || v_dt_str
            || CASE WHEN v_client_name IS NOT NULL THEN ' · Klijent: ' || v_client_name ELSE '' END,
          v_meta
        );
      END IF;
    ELSE
      -- Client self-booked
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
  END IF;

  -- ── Notify client of instant confirmation (skip guest and owner/staff-created) ──
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL
    AND NOT v_owner_created AND NOT v_staff_created
  THEN
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


-- ── 2. update_notification_prefs — add new keys ───────────────────────────────
CREATE OR REPLACE FUNCTION public.update_notification_prefs(p_prefs JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.profiles
  SET notification_prefs = jsonb_build_object(
    'push_enabled',               COALESCE((p_prefs->>'push_enabled')::BOOLEAN,               true),
    'email_enabled',              COALESCE((p_prefs->>'email_enabled')::BOOLEAN,              true),
    'quiet_enabled',              COALESCE((p_prefs->>'quiet_enabled')::BOOLEAN,              false),
    'quiet_from',                 p_prefs->>'quiet_from',
    'quiet_to',                   p_prefs->>'quiet_to',
    'quiet_tz',                   p_prefs->>'quiet_tz',
    'notify_new_booking',         COALESCE((p_prefs->>'notify_new_booking')::BOOLEAN,         true),
    'notify_new_booking_email',   COALESCE((p_prefs->>'notify_new_booking_email')::BOOLEAN,   true),
    'notify_staff_booking',       COALESCE((p_prefs->>'notify_staff_booking')::BOOLEAN,       true),
    'notify_staff_booking_email', COALESCE((p_prefs->>'notify_staff_booking_email')::BOOLEAN, true),
    'notify_staff_added_booking',       COALESCE((p_prefs->>'notify_staff_added_booking')::BOOLEAN,       true),
    'notify_staff_added_booking_email', COALESCE((p_prefs->>'notify_staff_added_booking_email')::BOOLEAN, true),
    'notify_cancellation',        COALESCE((p_prefs->>'notify_cancellation')::BOOLEAN,        true),
    'notify_cancellation_email',  COALESCE((p_prefs->>'notify_cancellation_email')::BOOLEAN,  true),
    'notify_reschedule',          COALESCE((p_prefs->>'notify_reschedule')::BOOLEAN,          true)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(JSONB) TO authenticated;
