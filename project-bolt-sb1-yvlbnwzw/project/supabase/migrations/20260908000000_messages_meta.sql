-- ─────────────────────────────────────────────────────────────────────────────
-- Matchmaking Faza 6 — Chat Translation
-- Dodaje meta jsonb kolonu na messages za keš prijevoda
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}';
