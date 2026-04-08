/*
  # Add System Messages Support

  1. Changes
    - Add `is_system` boolean column to messages table
      - Defaults to false for regular messages
      - When true, indicates a system-generated message
    - System messages are read-only notifications about key events
    - Examples: "Customer posted this job", "Pro contacted customer"
  
  2. Notes
    - System messages should be styled differently in UI (centered, muted)
    - System messages cannot be deleted or edited by users
    - System messages appear in chronological order with regular messages
*/

-- Add is_system column to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_system boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for efficient querying of system messages
CREATE INDEX IF NOT EXISTS idx_messages_is_system ON messages(is_system);

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Users can create system messages in their threads" ON messages;

-- Update RLS policies to allow system message creation
-- System messages should be creatable by authenticated users during specific events
CREATE POLICY "Users can create system messages in their threads"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system = true AND
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );
