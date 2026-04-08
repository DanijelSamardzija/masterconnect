/*
  # Auto-add receiver to thread participants

  1. Purpose
    - Automatically ensure receiver is added as thread participant when a message is sent
    - Fixes issue where users receive notifications but don't see threads in their Messages list
    
  2. Changes
    - Create trigger function to add receiver to thread_participants if not already present
    - Runs after INSERT on messages table
    - Only adds if receiver_id is not null and not already a participant
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Maintains data consistency automatically
*/

-- Create trigger function to auto-add receiver as thread participant
CREATE OR REPLACE FUNCTION auto_add_receiver_to_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add receiver as participant if not already added
  IF NEW.receiver_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at)
    VALUES (NEW.thread_id, NEW.receiver_id, NEW.created_at)
    ON CONFLICT (thread_id, user_id) WHERE deleted_at IS NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_add_receiver_to_thread ON messages;
CREATE TRIGGER trigger_auto_add_receiver_to_thread
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_receiver_to_thread();