/*
  # Fix: Reset deleted_at but preserve message history

  1. Problem with previous approach
    - Setting deleted_at = NULL shows ALL old messages
    - User wants to see ONLY new messages after deleting conversation

  2. Better Solution
    - Set deleted_at to timestamp just before the new message
    - This way: new message is visible (created_at > deleted_at)
    - But: old messages stay hidden

  3. Implementation
    - When new message arrives, set receiver's deleted_at to (new_message.created_at - 1 second)
    - This ensures new message passes the filter (created_at > deleted_at)
    - Old messages remain filtered out
*/

-- Update function to set deleted_at to just before new message timestamp
CREATE OR REPLACE FUNCTION reset_deleted_at_for_receiver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update deleted_at to just before this message's timestamp
  -- This makes the new message visible while keeping old messages hidden
  IF NEW.receiver_id IS NOT NULL THEN
    UPDATE thread_participants
    SET deleted_at = NEW.created_at - INTERVAL '1 second'
    WHERE thread_id = NEW.thread_id
      AND user_id = NEW.receiver_id
      AND deleted_at IS NOT NULL
      AND deleted_at < NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$;