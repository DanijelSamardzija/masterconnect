/*
  # Create Notifications Table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key) - Unique notification identifier
      - `user_id` (uuid, foreign key) - The user receiving the notification
      - `type` (text) - Notification type (e.g., "message")
      - `title` (text) - Notification title
      - `body` (text) - Notification body/description
      - `meta` (jsonb) - Additional metadata (senderId, messageId, threadId, etc.)
      - `read_at` (timestamptz, nullable) - When the notification was read (null = unread)
      - `created_at` (timestamptz) - When the notification was created

  2. Security
    - Enable RLS on `notifications` table
    - Add policy for users to read their own notifications
    - Add policy for authenticated users to insert notifications (for message senders)
    - Add policy for users to update their own notifications (mark as read)

  3. Indexes
    - Index on user_id for faster queries
    - Index on created_at for ordering
    - Index on read_at for filtering unread notifications
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'message',
  title text NOT NULL,
  body text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can insert notifications (for sending messages)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;