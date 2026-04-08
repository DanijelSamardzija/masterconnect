/*
  # Fix sender deleted_at logic

  1. Problem
    - Current trigger always updates sender's deleted_at even when sending messages
    - This causes sender to see only recent messages, not all messages in conversation
    
  2. Correct Logic
    - SENDER: Only update deleted_at if it was already set (they deleted conversation)
    - RECEIVER: Always reset deleted_at if it was set (so they see new messages)
    - NEW participants: deleted_at should be NULL (normal conversation)
    
  3. Implementation
    - For sender: only update if deleted_at IS NOT NULL
    - For receiver: always update if deleted_at IS NOT NULL
*/

CREATE OR REPLACE FUNCTION ensure_message_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add sender as participant (new participants get deleted_at = NULL)
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NULL)
  ON CONFLICT (thread_id, user_id) 
  DO UPDATE SET 
    deleted_at = CASE 
      -- If sender had deleted conversation, update to show new messages they're sending
      WHEN thread_participants.deleted_at IS NOT NULL 
      THEN NEW.created_at - INTERVAL '1 second'
      -- If sender never deleted conversation, keep it visible (NULL)
      ELSE NULL
    END;

  -- Add receiver as participant (if specified)
  IF NEW.receiver_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) 
    DO UPDATE SET 
      deleted_at = CASE 
        -- If receiver had deleted conversation, reset to show new incoming message
        WHEN thread_participants.deleted_at IS NOT NULL 
        THEN NEW.created_at - INTERVAL '1 second'
        -- If receiver never deleted conversation, keep it visible (NULL)
        ELSE NULL
      END;
  END IF;

  RETURN NEW;
END;
$$;