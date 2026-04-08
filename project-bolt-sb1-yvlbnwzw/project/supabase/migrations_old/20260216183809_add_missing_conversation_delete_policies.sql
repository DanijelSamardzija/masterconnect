/*
  # Add missing DELETE policies for conversation deletion

  1. Changes
    - Add DELETE policy for threads (users can delete threads they participate in)
    - Add DELETE policy for messages (users can delete messages in their threads)

  2. Security
    - Only users who are participants in a thread can delete it
    - Only users who are participants in a thread can delete messages in it
*/

-- Allow deleting threads for participants
CREATE POLICY "Users can delete threads they participate in"
  ON threads
  FOR DELETE
  TO authenticated
  USING (
    customer_id = auth.uid() OR pro_id = auth.uid()
  );

-- Allow deleting messages in threads the user is part of
CREATE POLICY "Users can delete messages in their threads"
  ON messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = messages.thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );
