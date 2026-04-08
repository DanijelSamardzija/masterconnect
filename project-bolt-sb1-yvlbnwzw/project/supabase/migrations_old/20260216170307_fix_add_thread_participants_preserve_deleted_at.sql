/*
  # Fix add_thread_participants to NOT reset deleted_at

  1. Problem
    - Previous migration resets deleted_at to NULL when add_thread_participants is called
    - This causes old messages to reappear when user clicks "Message" button after deleting conversation
    - Users want to see ONLY new messages after deleting a conversation

  2. Solution
    - Change add_thread_participants to preserve deleted_at timestamp
    - Only create participant record if it doesn't exist (don't update if exists)
    - This way, deleted_at remains set until user actually SENDS a message
    - Message sending will naturally reset deleted_at via separate logic

  3. Changes
    - Update add_thread_participants function to DO NOTHING on conflict
    - Update auto_add_thread_participants trigger to DO NOTHING on conflict
*/

-- Update add_thread_participants to preserve deleted_at
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

  -- Add customer as participant (don't update if already exists)
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (p_thread_id, p_customer_id, now(), NULL)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Add pro as participant (don't update if already exists)
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (p_thread_id, p_pro_id, now(), NULL)
  ON CONFLICT (thread_id, user_id) DO NOTHING;
END;
$$;

-- Update auto_add_thread_participants trigger to preserve deleted_at
CREATE OR REPLACE FUNCTION auto_add_thread_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add customer as participant (don't update if already exists)
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.customer_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Add pro as participant (don't update if already exists)
  IF NEW.pro_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.pro_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;