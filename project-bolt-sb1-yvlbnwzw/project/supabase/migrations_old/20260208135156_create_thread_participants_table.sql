/*
  # Create thread_participants table

  1. New Tables
    - `thread_participants`
      - `id` (uuid, primary key) - Unique identifier for each participant record
      - `thread_id` (uuid, foreign key) - References the thread
      - `user_id` (uuid, foreign key) - References the user/participant
      - `created_at` (timestamptz) - When the participant joined the thread
      - `deleted_at` (timestamptz, nullable) - When the participant left/was removed (soft delete)
  
  2. Indexes
    - Unique constraint on (thread_id, user_id) where deleted_at IS NULL
    - Index on thread_id for faster lookups
    - Index on user_id for faster user queries
    - Index on deleted_at for filtering active participants
  
  3. Security
    - Enable RLS on thread_participants table
    - Add policy for authenticated users to view participants in their threads
    - Add policy for authenticated users to insert themselves as participants
    - Add policy for authenticated users to soft-delete themselves from threads
  
  4. Data Migration
    - Populate with existing thread participants from threads table
    - Each thread has a customer_id and pro_id which become participants
*/

-- Create the thread_participants table
CREATE TABLE IF NOT EXISTS thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_id ON thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id ON thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_deleted_at ON thread_participants(deleted_at);

-- Create unique constraint to prevent duplicate active participants
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_participants_unique_active 
  ON thread_participants(thread_id, user_id) 
  WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view participants in threads they're part of
CREATE POLICY "Users can view participants in their threads"
  ON thread_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_participants.thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );

-- Policy: Users can add themselves as participants
CREATE POLICY "Users can join threads"
  ON thread_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_participants.thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );

-- Policy: Users can soft-delete themselves from threads
CREATE POLICY "Users can leave threads"
  ON thread_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migrate existing thread data to thread_participants
INSERT INTO thread_participants (thread_id, user_id, created_at)
SELECT id, customer_id, created_at
FROM threads
WHERE customer_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO thread_participants (thread_id, user_id, created_at)
SELECT id, pro_id, created_at
FROM threads
WHERE pro_id IS NOT NULL
ON CONFLICT DO NOTHING;