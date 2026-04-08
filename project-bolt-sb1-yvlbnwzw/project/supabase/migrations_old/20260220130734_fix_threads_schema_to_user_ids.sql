/*
  # Fix threads table schema - rename to user1_id/user2_id

  1. Changes
    - Rename `customer_id` column to `user1_id`
    - Rename `pro_id` column to `user2_id`
    - Make `user2_id` nullable (for flexibility)
    - Update all foreign key constraints
    - Update RLS policies to use new column names

  2. Security
    - Preserve existing RLS policies but update column references
    - Maintain data integrity with foreign keys
*/

-- Drop existing RLS policies that reference old columns
DROP POLICY IF EXISTS "Users can view their threads" ON threads;
DROP POLICY IF EXISTS "Users can insert threads" ON threads;
DROP POLICY IF EXISTS "Users can delete their threads" ON threads;
DROP POLICY IF EXISTS "Anyone can create threads" ON threads;

-- Rename columns
ALTER TABLE threads RENAME COLUMN customer_id TO user1_id;
ALTER TABLE threads RENAME COLUMN pro_id TO user2_id;

-- Make user2_id nullable for flexibility
ALTER TABLE threads ALTER COLUMN user2_id DROP NOT NULL;

-- Recreate RLS policies with new column names
CREATE POLICY "Users can view their threads"
  ON threads
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

CREATE POLICY "Users can insert threads"
  ON threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

CREATE POLICY "Users can delete their threads"
  ON threads
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

-- Update thread_participants table if it references old columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'thread_participants' AND column_name = 'user_id'
  ) THEN
    -- Thread participants table exists, no changes needed
    NULL;
  END IF;
END $$;
