/*
  # Improve Message Reaction RLS Policies

  1. Security Improvements
    - Update DELETE policy to verify user is still a thread participant
    - Update UPDATE policy to verify user is still a thread participant
    - This prevents users from modifying reactions after losing access to a thread

  2. Changes Made
    - Drop and recreate UPDATE policy with thread participant check
    - Drop and recreate DELETE policy with thread participant check
    - Maintains ownership check (auth.uid() = user_id)
    - Adds thread participation verification for both operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON message_reactions;

-- Recreate UPDATE policy with thread participant check
CREATE POLICY "Users can update their own reactions"
  ON message_reactions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = message_reactions.message_id
      AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = message_reactions.message_id
      AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    )
  );

-- Recreate DELETE policy with thread participant check
CREATE POLICY "Users can delete their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = message_reactions.message_id
      AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    )
  );
