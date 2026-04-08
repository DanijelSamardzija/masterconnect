/*
  # Fix all thread-related functions to use user1_id and user2_id

  1. Changes
    - Drop and recreate add_thread_participants function with new column names
*/

-- Drop old function first
DROP FUNCTION IF EXISTS add_thread_participants(uuid, uuid, uuid);

-- Recreate with new parameter names
CREATE OR REPLACE FUNCTION add_thread_participants(p_thread_id uuid, p_user1_id uuid, p_user2_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify that the caller is part of this thread
  IF NOT EXISTS (
    SELECT 1 FROM threads
    WHERE id = p_thread_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to add participants to this thread';
  END IF;

  -- Add user1 as participant (don't update if already exists)
  IF p_user1_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (p_thread_id, p_user1_id, now(), NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Add user2 as participant (don't update if already exists)
  IF p_user2_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (p_thread_id, p_user2_id, now(), NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;