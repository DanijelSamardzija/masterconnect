-- Add hidden_before to thread_participants so that when a user deletes a conversation
-- and the other person sends a new message, old messages before deletion are hidden.

ALTER TABLE thread_participants
  ADD COLUMN IF NOT EXISTS hidden_before timestamptz DEFAULT NULL;

-- Update the reset trigger: still reset deleted_at (thread reappears) but keep hidden_before
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
