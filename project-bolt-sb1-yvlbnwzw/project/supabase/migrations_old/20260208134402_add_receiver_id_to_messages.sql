/*
  # Add receiver_id to messages table

  1. Changes
    - Add receiver_id column to messages table
    - Populate receiver_id from thread participants
    - Create index for efficient unread message queries
    
  2. New Columns
    - receiver_id (uuid, not null)
      - References profiles.id
      - The intended recipient of the message
      - Derived from thread participants (opposite of sender)
  
  3. Behavior
    - For messages in a thread:
      - If sender is customer, receiver is pro
      - If sender is pro, receiver is customer
    - Used for unread message counts and delivery tracking
*/

-- Add receiver_id column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES profiles(id);

-- Populate receiver_id for existing messages
UPDATE messages m
SET receiver_id = CASE
  WHEN m.sender_id = t.customer_id THEN t.pro_id
  WHEN m.sender_id = t.pro_id THEN t.customer_id
  ELSE NULL
END
FROM threads t
WHERE m.thread_id = t.id AND m.receiver_id IS NULL;

-- Make receiver_id not null after populating
ALTER TABLE messages
ALTER COLUMN receiver_id SET NOT NULL;

-- Create indexes for efficient unread message queries
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_seen ON messages(receiver_id, seen_at) WHERE seen_at IS NULL;