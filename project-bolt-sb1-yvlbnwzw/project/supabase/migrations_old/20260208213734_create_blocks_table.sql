/*
  # Create Blocks Table for User Blocking

  1. New Tables
    - `blocks`
      - `id` (uuid, primary key)
      - `blocker_user_id` (uuid, references profiles) - user who is blocking
      - `blocked_user_id` (uuid, references profiles) - user being blocked
      - `created_at` (timestamptz)

  2. Constraints
    - Unique constraint on (blocker_user_id, blocked_user_id) to prevent duplicate blocks
    - Check constraint to prevent users from blocking themselves

  3. Security
    - Enable RLS
    - Users can create their own blocks
    - Users can delete their own blocks
    - Users can read their own blocks (both as blocker and blocked)

  4. Indexes
    - Index on blocker_user_id for fast lookups
    - Index on blocked_user_id for checking if user is blocked
*/

CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_block UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT no_self_block CHECK (blocker_user_id != blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair ON blocks(blocker_user_id, blocked_user_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own blocks"
  ON blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can view their blocks as blocker"
  ON blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_user_id);

CREATE POLICY "Users can view blocks where they are blocked"
  ON blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = blocked_user_id);

CREATE POLICY "Users can delete their own blocks"
  ON blocks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_user_id);