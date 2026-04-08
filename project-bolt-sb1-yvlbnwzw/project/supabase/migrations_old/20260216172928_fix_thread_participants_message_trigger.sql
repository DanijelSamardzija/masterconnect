/*
  # Fix thread participants trigger for messages

  1. Problem
    - Multiple conflicting triggers trying to add thread participants
    - `auto_add_receiver_to_thread` has wrong ON CONFLICT clause with WHERE deleted_at IS NULL
    - This causes INSERT to fail when receiver already exists as participant with deleted_at set
    - Result: receiver is never added back to conversation

  2. Solution
    - Drop duplicate/conflicting triggers
    - Create single unified trigger that handles both sender and receiver
    - Properly handle deleted_at: reset to message timestamp to make conversation visible

  3. Implementation
    - Drop old triggers
    - Create new function that adds sender + receiver and resets their deleted_at
    - Run BEFORE INSERT to ensure participants exist before RLS checks
*/

-- Drop old conflicting triggers
DROP TRIGGER IF EXISTS trigger_auto_add_receiver_to_thread ON messages;
DROP TRIGGER IF EXISTS trigger_add_message_participants ON messages;

-- Drop old functions
DROP FUNCTION IF EXISTS auto_add_receiver_to_thread();
DROP FUNCTION IF EXISTS add_message_participants_to_thread();

-- Create unified function to handle both sender and receiver participants
CREATE OR REPLACE FUNCTION ensure_message_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add or update sender as participant
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (NEW.thread_id, NEW.sender_id, NEW.created_at, NEW.created_at - INTERVAL '1 second')
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
    VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at, NEW.created_at - INTERVAL '1 second')
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

-- Create trigger that runs BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_ensure_message_participants ON messages;
CREATE TRIGGER trigger_ensure_message_participants
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_message_participants();