/*
  # Fix trigger to re-add deleted participants when receiving new messages

  1. Problem
    - When user A deletes conversation, their participant record is deleted
    - When user B sends a new message, user A is not re-added
    - User A doesn't see the new message notification
    
  2. Solution
    - When sender or receiver doesn't exist as participant, add them
    - Set deleted_at = (message.created_at - 1 second) so they only see new messages
    - This makes the conversation reappear with only new messages visible
    
  3. Implementation
    - Update ensure_message_participants trigger
    - For non-existent participants: INSERT with deleted_at = (message.created_at - 1s)
    - For existing participants: Update deleted_at only if it was set (preserve NULL)
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
    -- Update existing sender participant (reset deleted_at if it was set)
    UPDATE thread_participants 
    SET deleted_at = CASE 
      WHEN deleted_at IS NOT NULL 
      THEN NEW.created_at - INTERVAL '1 second'
      ELSE deleted_at
    END
    WHERE thread_id = NEW.thread_id AND user_id = NEW.sender_id;
  ELSE
    -- Add sender as participant with deleted_at = NULL (they sent the message, so they should see everything)
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
      -- Update existing receiver participant
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
