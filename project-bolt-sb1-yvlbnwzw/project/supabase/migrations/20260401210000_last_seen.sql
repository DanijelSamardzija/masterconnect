-- Add last_seen to profiles for online status tracking

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Allow any authenticated user to read last_seen (needed for online indicators)
-- (profiles table already has RLS allowing SELECT to authenticated users)

-- Index for efficient recency queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);
