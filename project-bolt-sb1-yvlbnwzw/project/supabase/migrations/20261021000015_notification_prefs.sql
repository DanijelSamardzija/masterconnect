-- Add notification_prefs column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';

-- Function for users to update their own notification preferences
CREATE OR REPLACE FUNCTION public.update_notification_prefs(p_prefs JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Sanitize: only store known keys
  UPDATE public.profiles
  SET notification_prefs = jsonb_build_object(
    'push_enabled',  COALESCE((p_prefs->>'push_enabled')::BOOLEAN,  true),
    'email_enabled', COALESCE((p_prefs->>'email_enabled')::BOOLEAN, true),
    'quiet_enabled', COALESCE((p_prefs->>'quiet_enabled')::BOOLEAN, false),
    'quiet_from',    p_prefs->>'quiet_from',
    'quiet_to',      p_prefs->>'quiet_to',
    'quiet_tz',      p_prefs->>'quiet_tz'
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(JSONB) TO authenticated;
