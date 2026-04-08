/*
  # Auto-add Thread Participants Trigger

  1. Changes
    - Create a trigger function that automatically adds both customer and pro as participants when a new thread is created
    - This ensures both parties always see the thread in their Messages list
    - Runs after INSERT on threads table

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only triggers on INSERT, not on UPDATE or DELETE
    - Automatically maintains data consistency
*/

-- Create trigger function to auto-add thread participants
CREATE OR REPLACE FUNCTION auto_add_thread_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add customer as participant
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at)
    VALUES (NEW.id, NEW.customer_id, NEW.created_at)
    ON CONFLICT (thread_id, user_id) WHERE deleted_at IS NULL DO NOTHING;
  END IF;

  -- Add pro as participant
  IF NEW.pro_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at)
    VALUES (NEW.id, NEW.pro_id, NEW.created_at)
    ON CONFLICT (thread_id, user_id) WHERE deleted_at IS NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_add_thread_participants ON threads;
CREATE TRIGGER trigger_auto_add_thread_participants
  AFTER INSERT ON threads
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_thread_participants();