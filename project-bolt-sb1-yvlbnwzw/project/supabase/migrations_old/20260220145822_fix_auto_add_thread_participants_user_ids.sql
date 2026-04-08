/*
  # Fix auto_add_thread_participants function to use user1_id and user2_id

  1. Changes
    - Replace NEW.customer_id with NEW.user1_id
    - Replace NEW.pro_id with NEW.user2_id
    - Update function to work with new column names
*/

CREATE OR REPLACE FUNCTION auto_add_thread_participants()
RETURNS TRIGGER AS $$
BEGIN
  -- Add user1 as participant (don't update if already exists)
  IF NEW.user1_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.user1_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  -- Add user2 as participant (don't update if already exists)
  IF NEW.user2_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.user2_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;