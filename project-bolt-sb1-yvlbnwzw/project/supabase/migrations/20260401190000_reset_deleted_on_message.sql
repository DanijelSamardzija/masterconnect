-- When a new message is sent, reset deleted_at for ALL participants of that thread.
-- This ensures the receiver sees the conversation reappear even if they had deleted it.

CREATE OR REPLACE FUNCTION reset_thread_deleted_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE thread_participants
  SET deleted_at = NULL
  WHERE thread_id = NEW.thread_id
    AND deleted_at IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_reset_deleted ON messages;
CREATE TRIGGER on_message_reset_deleted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION reset_thread_deleted_on_message();
