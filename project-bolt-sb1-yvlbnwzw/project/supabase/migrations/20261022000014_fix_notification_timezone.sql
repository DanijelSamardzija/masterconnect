-- Fix notification times: show local business time instead of UTC
--
-- Before: "Brijanje · 23.09.2026 · 07:00 UTC"
-- After:  "Brijanje · 23.09.2026 · 09:00"
--
-- Strategy:
--   1. Add timezone-aware overload of private_fmt_booking_dt
--   2. Update notify_booking_created to look up location timezone
--      and pass it to the formatter

-- ── Timezone-aware formatter ──────────────────────────────────────────────────
-- Accepts timezone string (e.g. 'Europe/Belgrade'). Falls back to UTC if NULL.
CREATE OR REPLACE FUNCTION private_fmt_booking_dt(p_ts TIMESTAMPTZ, p_tz TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(p_ts AT TIME ZONE COALESCE(NULLIF(p_tz, ''), 'UTC'), 'DD.MM.YYYY · HH24:MI');
$$;

-- Also update the no-arg version to drop the " UTC" suffix so old callers
-- (other triggers that don't yet pass a timezone) still look clean.
CREATE OR REPLACE FUNCTION private_fmt_booking_dt(p_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(p_ts AT TIME ZONE 'UTC', 'DD.MM.YYYY · HH24:MI');
$$;

-- ── notify_booking_created (timezone-aware) ───────────────────────────────────
-- Replaces the version from 20261022000012_fix_notify_booking_created.sql
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
  v_meta          JSONB;
  v_timezone      TEXT;
BEGIN
  v_caller_uid := auth.uid();

  SELECT name INTO v_client_name   FROM profiles        WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

  -- Look up the business location's timezone so times show in local time
  IF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM business_locations WHERE id = NEW.location_id LIMIT 1;
  END IF;
  v_timezone := COALESCE(v_timezone, 'UTC');

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at, v_timezone);

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

  -- Notify assigned staff (if any, if not the client, if they didn't create this booking)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_uid IS NOT NULL
      AND (NEW.client_id IS NULL OR v_staff_uid <> NEW.client_id)
      AND (v_caller_uid IS NULL OR v_staff_uid <> v_caller_uid)
    THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- Notify owner (if they didn't create this booking themselves)
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

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

  -- Notify client of instant confirmation (skip for guest bookings)
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL THEN
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
