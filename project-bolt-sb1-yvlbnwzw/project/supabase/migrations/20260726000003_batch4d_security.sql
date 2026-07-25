-- Batch 4D Security Fixes
-- Fix 1: messages INSERT — restrict to thread participants (prevents message injection into foreign threads)
-- Fix 2: mark_messages_read RPC — replaces broad recipient UPDATE policy (prevents column spoofing)
-- Fix 3: message_attachments SELECT — restrict to thread participants (was: any authenticated user)
-- file_path column: forward-compat for future Storage Security Refactor (file_url stays primary for now)

-- ============================================================
-- Fix 1: messages INSERT
-- ============================================================
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Thread participants can send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM thread_participants
      WHERE thread_id  = messages.thread_id
        AND user_id    = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- ============================================================
-- Fix 2: mark_messages_read RPC (replaces broad UPDATE policy)
-- ============================================================
DROP POLICY IF EXISTS "Thread participants can mark messages as read" ON messages;

CREATE OR REPLACE FUNCTION mark_messages_read(p_message_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE messages
  SET
    delivered_at = COALESCE(delivered_at, now()),
    seen_at      = COALESCE(seen_at, now()),
    read_at      = COALESCE(read_at, now())
  WHERE
    id          = ANY(p_message_ids)
    AND receiver_id = auth.uid()
    AND sender_id   != auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION mark_messages_read(uuid[]) TO authenticated;

-- ============================================================
-- Fix 3: message_attachments SELECT
-- ============================================================
DROP POLICY IF EXISTS "Message participants can view attachments" ON message_attachments;
CREATE POLICY "Thread participants can view attachments" ON message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM messages m
      JOIN thread_participants tp ON tp.thread_id = m.thread_id
      WHERE m.id          = message_attachments.message_id
        AND tp.user_id    = auth.uid()
        AND tp.deleted_at IS NULL
    )
  );

-- ============================================================
-- file_path column (forward-compat for Storage Security Refactor)
-- NULL for existing rows and Cloudinary videos; populated for new Supabase Storage uploads.
-- ============================================================
ALTER TABLE message_attachments
  ADD COLUMN IF NOT EXISTS file_path TEXT;
