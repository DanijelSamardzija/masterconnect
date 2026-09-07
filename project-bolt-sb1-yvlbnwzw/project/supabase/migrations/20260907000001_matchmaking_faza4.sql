-- =============================================================
-- Matchmaking Faza 4: Notifikacije
-- =============================================================

-- ── F2 gap (bilo potrebno u Fazi 3, dodato sada) ──────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability      text;

-- ── Opt-out flag za match notifikacije ───────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS match_notifications_enabled boolean NOT NULL DEFAULT true;

-- ── matchmaking_notification_log ──────────────────────────────
-- Prati svaku match notifikaciju poslanu profesionalcu.
-- Invariante:
--   • UNIQUE(professional_id, post_id) — jedan prof ne dobije dvije notif za isti oglas
--   • credits_charged = 0 ako je unutar prvih 3 te kalendarske mjeseca
--   • credits_charged = 5 za 4. i svaku sljedeću notif tog mjeseca
CREATE TABLE IF NOT EXISTS matchmaking_notification_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id           uuid        NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  post_owner_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score             integer,
  credits_charged   integer     NOT NULL DEFAULT 0,
  notification_type text        NOT NULL DEFAULT 'match_found',
  sent_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(professional_id, post_id)
);

CREATE INDEX IF NOT EXISTS matchmaking_notification_log_professional_idx
  ON matchmaking_notification_log(professional_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS matchmaking_notification_log_post_idx
  ON matchmaking_notification_log(post_id);

ALTER TABLE matchmaking_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals view own notifications"
  ON matchmaking_notification_log FOR SELECT TO authenticated
  USING (professional_id = auth.uid());

CREATE POLICY "Admins view all match notifications"
  ON matchmaking_notification_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role manages match notifications"
  ON matchmaking_notification_log FOR ALL TO service_role
  USING (true);

GRANT ALL ON matchmaking_notification_log TO service_role;

-- ── Helper RPC: koliko match notifikacija je prof dobio u tekućem mjesecu ──
CREATE OR REPLACE FUNCTION get_monthly_match_notification_count(p_professional_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM matchmaking_notification_log
  WHERE professional_id = p_professional_id
    AND date_trunc('month', sent_at) = date_trunc('month', now());
$$;

REVOKE ALL ON FUNCTION get_monthly_match_notification_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_monthly_match_notification_count(uuid) TO service_role;
