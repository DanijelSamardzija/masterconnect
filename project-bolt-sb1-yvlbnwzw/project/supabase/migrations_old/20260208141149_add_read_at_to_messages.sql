/*
  # Add read_at column to messages table

  1. Changes
    - Add `read_at` column to `messages` table
      - Type: timestamptz (nullable)
      - Purpose: Track when a message was read by the receiver
      - Different from `seen_at`: seen_at tracks when message list was viewed, read_at tracks when specific message was opened/read
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Nullable to allow for unread messages
*/

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;
