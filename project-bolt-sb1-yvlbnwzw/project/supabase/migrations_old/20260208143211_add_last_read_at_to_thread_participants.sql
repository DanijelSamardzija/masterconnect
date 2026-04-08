/*
  # Add last_read_at to thread_participants

  1. Changes
    - Add `last_read_at` (timestamptz, nullable) to `thread_participants` table
      - Tracks when a user last viewed/read messages in a thread
      - NULL means the user has never viewed the thread
      - Used to calculate unread message counts efficiently
  
  2. Benefits
    - More efficient than marking individual messages as read
    - Single timestamp per thread instead of per message
    - Scales better with high message volumes
  
  3. Usage
    - Set to current timestamp when user opens a thread
    - Compare with message.created_at to determine unread messages
    - Messages created after last_read_at are considered unread
*/

-- Add last_read_at column to thread_participants
ALTER TABLE thread_participants 
ADD COLUMN IF NOT EXISTS last_read_at timestamptz NULL;

-- Create index for efficient unread count queries
CREATE INDEX IF NOT EXISTS idx_thread_participants_last_read_at 
  ON thread_participants(last_read_at) 
  WHERE last_read_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN thread_participants.last_read_at IS 
  'Timestamp when user last viewed/read messages in this thread. Used to calculate unread message counts.';