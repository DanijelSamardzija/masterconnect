-- Allow thread participants (recipients) to mark received messages as delivered/seen/read.
-- The existing policy only lets the sender update their own messages.
-- This policy allows the recipient (any thread participant who is NOT the sender) to update
-- seen_at, delivered_at, and read_at on messages sent to them.

CREATE POLICY "Thread participants can mark messages as read" ON messages
  FOR UPDATE TO authenticated
  USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM thread_participants
      WHERE thread_participants.thread_id = messages.thread_id
        AND thread_participants.user_id = auth.uid()
        AND thread_participants.deleted_at IS NULL
    )
  )
  WITH CHECK (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM thread_participants
      WHERE thread_participants.thread_id = messages.thread_id
        AND thread_participants.user_id = auth.uid()
        AND thread_participants.deleted_at IS NULL
    )
  );
