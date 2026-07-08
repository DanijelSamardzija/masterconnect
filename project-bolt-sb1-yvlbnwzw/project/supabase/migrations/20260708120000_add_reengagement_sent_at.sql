ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reengagement_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_reengagement
  ON profiles(last_seen, reengagement_sent_at)
  WHERE email IS NOT NULL;
