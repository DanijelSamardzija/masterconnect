/*
  # Add Message Reactions

  1. New Tables
    - `message_reactions`
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key to messages)
      - `user_id` (uuid, foreign key to auth.users)
      - `emoji` (text, the reaction emoji)
      - `created_at` (timestamptz, default now())
      - Unique constraint on (message_id, user_id) - one reaction per user per message

  2. Security
    - Enable RLS on `message_reactions` table
    - Add policy for thread participants to read reactions
    - Add policy for authenticated users to add their own reactions
    - Add policy for users to update their own reactions
    - Add policy for users to delete their own reactions
*/

CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = message_reactions.message_id
      AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    )
  );

CREATE POLICY "Users can add their own reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = message_reactions.message_id
      AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own reactions"
  ON message_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);