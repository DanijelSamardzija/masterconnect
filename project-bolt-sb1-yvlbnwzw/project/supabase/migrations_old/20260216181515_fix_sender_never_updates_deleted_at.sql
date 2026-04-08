/*
  # Fix sender deleted_at - sender should never update their own deleted_at

  1. Problem
    - When sender sends a message, trigger updates their deleted_at
    - This causes their own message to be hidden
    
  2. Correct Logic
    - SENDER: Only INSERT if not exists (with deleted_at = NULL), never UPDATE
    - RECEIVER: Always reset deleted_at if it was set (so they see new messages)
    
  3. Why this works
    - If you delete conversation → deleted_at = timestamp
    - If you send message → deleted_at stays same (only frontend filters)
    - If someone sends you message → your deleted_at resets to see new messages
    
  4. Implementation
    - For sender: INSERT ... ON CONFLICT DO NOTHING (don't update)
    - For receiver: INSERT ... ON CONFLICT DO UPDATE (always reset if needed)
*/

CREATE OR REPLACE FUNCTION ensure_message_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add sender as participant (never update if already exists)
  -- This preserves sender's deleted_at setting (if they deleted conversation)
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NULL)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Add receiver as participant (if specified)
  -- Always reset deleted_at so receiver sees new incoming message
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