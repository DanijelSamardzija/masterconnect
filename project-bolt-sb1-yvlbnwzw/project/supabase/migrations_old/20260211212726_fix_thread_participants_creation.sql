/*
  # Fix Thread Participants Creation

  1. Changes
    - Create a database function to add both participants to a thread
    - This bypasses RLS so both customer and pro can be added atomically
    - Function is secured - only the thread creator (customer or pro) can call it

  2. Security
    - Function runs with SECURITY DEFINER (elevated privileges)
    - Validates that caller is either customer_id or pro_id of the thread
    - Only adds the two intended participants (customer and pro)
*/

-- Create function to add both participants to a thread
CREATE OR REPLACE FUNCTION add_thread_participants(
  p_thread_id uuid,
  p_customer_id uuid,
  p_pro_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify that the caller is part of this thread
  IF NOT EXISTS (
    SELECT 1 FROM threads
    WHERE id = p_thread_id
    AND (customer_id = auth.uid() OR pro_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to add participants to this thread';
  END IF;

  -- Add customer as participant if not exists
  INSERT INTO thread_participants (thread_id, user_id)
  VALUES (p_thread_id, p_customer_id)
  ON CONFLICT (thread_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET deleted_at = NULL
  WHERE thread_participants.deleted_at IS NOT NULL;

  -- Add pro as participant if not exists
  INSERT INTO thread_participants (thread_id, user_id)
  VALUES (p_thread_id, p_pro_id)
  ON CONFLICT (thread_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET deleted_at = NULL
  WHERE thread_participants.deleted_at IS NOT NULL;
END;
$$;