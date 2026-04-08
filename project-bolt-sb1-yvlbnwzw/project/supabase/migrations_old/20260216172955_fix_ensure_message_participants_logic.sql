/*
  # Fix ensure_message_participants logic

  1. Problem
    - Previous version always set deleted_at when creating new participants
    - This causes all conversations to be hidden by default
    
  2. Correct Logic
    - New participants should have deleted_at = NULL (conversation visible)
    - Existing participants with deleted_at = NULL should stay NULL
    - Existing participants with deleted_at set should be reset to (message.created_at - 1s)
    
  3. Implementation
    - Insert with deleted_at = NULL for new participants
    - Update only if deleted_at IS NOT NULL
*/

CREATE OR REPLACE FUNCTION ensure_message_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add or update sender as participant
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NULL)
  ON CONFLICT (thread_id, user_id) 
  DO UPDATE SET 
    deleted_at = CASE 
      WHEN thread_participants.deleted_at IS NOT NULL 
      THEN NEW.created_at - INTERVAL '1 second'
      ELSE thread_participants.deleted_at
    END;

  -- Add or update receiver as participant (if specified)
  IF NEW.receiver_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) 
    DO UPDATE SET 
      deleted_at = CASE 
        WHEN thread_participants.deleted_at IS NOT NULL 
        THEN NEW.created_at - INTERVAL '1 second'
        ELSE thread_participants.deleted_at
      END;
  END IF;

  RETURN NEW;
END;
$$;