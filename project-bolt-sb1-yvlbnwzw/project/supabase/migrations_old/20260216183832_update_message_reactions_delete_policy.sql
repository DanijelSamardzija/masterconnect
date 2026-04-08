/*
  # Update message_reactions DELETE policy to allow thread deletion

  1. Changes
    - Drop existing DELETE policy for message_reactions
    - Create new policy that allows users to delete ANY reactions in threads they participate in
    - This is needed so users can delete entire threads including all reactions

  2. Security
    - Users can only delete reactions in threads they are participants of
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can delete their own reactions" ON message_reactions;

-- Create new policy that allows deleting any reactions in user's threads
CREATE POLICY "Users can delete reactions in their threads"
  ON message_reactions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      INNER JOIN threads ON threads.id = messages.thread_id
      WHERE messages.id = message_reactions.message_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );
