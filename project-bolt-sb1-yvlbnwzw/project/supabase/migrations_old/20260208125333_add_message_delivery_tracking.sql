/*
  # Add Message Delivery and Read Receipt Tracking

  1. Changes
    - Add delivered_at column to track when message was delivered
    - Add seen_at column to track when message was read/seen
    
  2. New Columns
    - delivered_at (timestamptz, nullable)
      - Set when recipient's client acknowledges message delivery
      - Used for single-check mark indicator
    
    - seen_at (timestamptz, nullable)
      - Set when recipient actually views/reads the message
      - Used for double-check mark indicator
      - Typically set when message appears in viewport
  
  3. Behavior
    - Messages start with both fields as NULL
    - delivered_at is set first when recipient connects
    - seen_at is set when message is viewed in chat
    - Both timestamps are optional and progressive
*/

-- Add delivery tracking columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- Create index for efficient queries on delivered/seen status
CREATE INDEX IF NOT EXISTS idx_messages_delivered_at ON messages(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_seen_at ON messages(seen_at) WHERE seen_at IS NOT NULL;