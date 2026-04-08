/*
  # Fix Thread Participants Duplicate Issue

  1. Problem
    - Current unique constraint allows multiple rows for same (thread_id, user_id) if deleted_at IS NOT NULL
    - This causes duplicate participant records when conversation is deleted and restarted
    - Results in old deleted_at values being picked up when fetching messages

  2. Solution
    - Remove partial unique index that only applies when deleted_at IS NULL
    - Add full unique constraint on (thread_id, user_id) without WHERE clause
    - Update add_thread_participants function to properly handle existing rows
    - Clean up any existing duplicates before applying constraint

  3. Changes
    - Drop old partial unique index
    - Delete duplicate rows, keeping only the most recent one
    - Create new unique constraint
    - Fix add_thread_participants function
*/

-- First, clean up any duplicate rows
-- Keep only the most recent row for each (thread_id, user_id) combination
DELETE FROM thread_participants a
USING thread_participants b
WHERE a.thread_id = b.thread_id
  AND a.user_id = b.user_id
  AND a.id < b.id;

-- Drop the old partial unique index
DROP INDEX IF EXISTS idx_thread_participants_unique_active;

-- Create new unique constraint without WHERE clause
-- This prevents ANY duplicates, regardless of deleted_at
ALTER TABLE thread_participants
  DROP CONSTRAINT IF EXISTS thread_participants_thread_user_unique;

ALTER TABLE thread_participants
  ADD CONSTRAINT thread_participants_thread_user_unique 
  UNIQUE (thread_id, user_id);

-- Update the add_thread_participants function to handle existing rows properly
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

  -- Add or reactivate customer as participant
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (p_thread_id, p_customer_id, now(), NULL)
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET deleted_at = NULL;

  -- Add or reactivate pro as participant
  INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
  VALUES (p_thread_id, p_pro_id, now(), NULL)
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET deleted_at = NULL;
END;
$$;

-- Update the auto_add_thread_participants trigger function
CREATE OR REPLACE FUNCTION auto_add_thread_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add customer as participant
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.customer_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET deleted_at = NULL;
  END IF;

  -- Add pro as participant
  IF NEW.pro_id IS NOT NULL THEN
    INSERT INTO thread_participants (thread_id, user_id, created_at, deleted_at)
    VALUES (NEW.id, NEW.pro_id, NEW.created_at, NULL)
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET deleted_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;
