/*
  # Final fix for participant logic with deleted conversations

  1. Correct Logic
    SENDER (person sending the message):
      - If they don't exist as participant: Create with deleted_at = NULL
      - If they exist with deleted_at set: Reset to NULL (they're sending, they want to see all)
      - If they exist with deleted_at = NULL: Keep it NULL
    
    RECEIVER (person receiving the message):
      - If they don't exist as participant: Create with deleted_at = (message time - 1s)
      - If they exist with deleted_at set: Reset to (message time - 1s) so they only see new messages
      - If they exist with deleted_at = NULL: Keep it NULL (they haven't deleted, show all)
  
  2. Why this logic?
    - When you SEND a message, you clearly want to see the conversation again (so show all messages)
    - When you RECEIVE a message after deleting, you only want to see new messages (not old ones)
*/

CREATE OR REPLACE FUNCTION ensure_message_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_exists BOOLEAN;
  receiver_exists BOOLEAN;
BEGIN
  -- Check if sender participant exists
  SELECT EXISTS(
    SELECT 1 FROM thread_participants 
    WHERE thread_id = NEW.thread_id AND user_id = NEW.sender_id
  ) INTO sender_exists;

  IF sender_exists THEN
    -- Update existing sender: Always reset deleted_at to NULL
    -- (they're sending a message, so they want to see the full conversation)
    UPDATE thread_participants 
    SET deleted_at = NULL
    WHERE thread_id = NEW.thread_id AND user_id = NEW.sender_id;
  ELSE
    -- Add sender as participant with deleted_at = NULL
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NULL);
  END IF;

  -- Handle receiver if specified
  IF NEW.receiver_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM thread_participants 
      WHERE thread_id = NEW.thread_id AND user_id = NEW.receiver_id
    ) INTO receiver_exists;

    IF receiver_exists THEN
      -- Update existing receiver: Only update if deleted_at was set
      -- (they deleted it, so only show messages from this point forward)
      UPDATE thread_participants 
      SET deleted_at = CASE 
        WHEN deleted_at IS NOT NULL 
        THEN NEW.created_at - INTERVAL '1 second'
        ELSE deleted_at
      END
      WHERE thread_id = NEW.thread_id AND user_id = NEW.receiver_id;
    ELSE
      -- Add receiver as participant with deleted_at set to just before message
      -- This way they only see messages from this point forward
      INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
      VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at, NEW.created_at - INTERVAL '1 second');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
