/*
  # Add system_message_type to messages table

  1. Changes
    - Add `system_message_type` column to `messages` table to store the type of system message
    - This allows dynamic translation of system messages on the client side

  2. Notes
    - Existing system messages will have NULL for this field
    - New system messages will store the type (e.g., 'job_completed', 'completion_requested')
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'system_message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN system_message_type text;
  END IF;
END $$;