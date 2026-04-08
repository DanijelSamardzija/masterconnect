/*
  # Reset deleted_at when new message arrives

  1. Problem
    - When user A deletes conversation, their deleted_at is set
    - When user B sends a new message, user A doesn't see it
    - Conversation doesn't appear in user A's messages list
    - No notification is sent to user A

  2. Solution
    - Create trigger that automatically resets deleted_at for RECEIVER when new message arrives
    - This makes conversation reappear in their list
    - Only messages after the original deleted_at timestamp are visible
    - Preserves privacy - old messages stay hidden

  3. Implementation
    - Trigger runs AFTER INSERT on messages table
    - Resets deleted_at to NULL for the message receiver
    - Does NOT reset deleted_at for the sender
*/

-- Create function to reset deleted_at for receiver when new message arrives
CREATE OR REPLACE FUNCTION reset_deleted_at_for_receiver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset deleted_at for the receiver if they had hidden this conversation
  IF NEW.receiver_id IS NOT NULL THEN
    UPDATE thread_participants
    SET deleted_at = NULL
    WHERE thread_id = NEW.thread_id
      AND user_id = NEW.receiver_id
      AND deleted_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_reset_deleted_at_for_receiver ON messages;
CREATE TRIGGER trigger_reset_deleted_at_for_receiver
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION reset_deleted_at_for_receiver();