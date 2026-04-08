/*
  # Prevent recreating deleted participants

  1. Problem
    - When user deletes conversation, their thread_participant record is deleted
    - When the other person sends a new message, the trigger recreates the participant
    - This makes old messages reappear
    
  2. Solution
    - Check if participant was explicitly deleted (doesn't exist in DB)
    - If they don't exist, DO NOT recreate them
    - Only update existing participants with deleted_at set (for soft delete scenarios)
    
  3. Implementation
    - Update trigger to only work with existing participants
    - Never INSERT a participant for a user who explicitly removed themselves
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

  -- Only add/update sender if they already exist or if this is first message
  -- (Don't recreate if they explicitly deleted the conversation)
  IF sender_exists THEN
    -- Update existing participant (reset deleted_at if it was set)
    UPDATE thread_participants 
    SET deleted_at = CASE 
      WHEN deleted_at IS NOT NULL 
      THEN NEW.created_at - INTERVAL '1 second'
      ELSE deleted_at
    END
    WHERE thread_id = NEW.thread_id AND user_id = NEW.sender_id;
  ELSE
    -- Only insert if this is a new conversation (no participants yet)
    -- Don't insert if receiver exists but sender doesn't (means sender deleted it)
    IF NOT EXISTS(SELECT 1 FROM thread_participants WHERE thread_id = NEW.thread_id) THEN
      INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
      VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NULL);
    END IF;
  END IF;

  -- Handle receiver if specified
  IF NEW.receiver_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM thread_participants 
      WHERE thread_id = NEW.thread_id AND user_id = NEW.receiver_id
    ) INTO receiver_exists;

    IF receiver_exists THEN
      -- Update existing participant
      UPDATE thread_participants 
      SET deleted_at = CASE 
        WHEN deleted_at IS NOT NULL 
        THEN NEW.created_at - INTERVAL '1 second'
        ELSE deleted_at
      END
      WHERE thread_id = NEW.thread_id AND user_id = NEW.receiver_id;
    ELSE
      -- Only insert if this is a new conversation
      IF NOT EXISTS(SELECT 1 FROM thread_participants WHERE thread_id = NEW.thread_id) THEN
        INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
        VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at, NULL);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
