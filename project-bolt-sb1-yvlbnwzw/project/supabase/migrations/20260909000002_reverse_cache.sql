-- Per-user server cache for reverse pipeline results (1h TTL)

CREATE TABLE IF NOT EXISTS matchmaking_reverse_cache (
  user_id         uuid         PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  ranked_posts    jsonb        NOT NULL DEFAULT '[]',
  candidate_count integer      NOT NULL DEFAULT 0,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10,6),
  expires_at      timestamptz  NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mrc_expires
  ON matchmaking_reverse_cache(expires_at);

ALTER TABLE matchmaking_reverse_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reverse cache"
  ON matchmaking_reverse_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages reverse cache"
  ON matchmaking_reverse_cache FOR ALL TO service_role
  USING (true);

GRANT ALL ON matchmaking_reverse_cache TO service_role;
