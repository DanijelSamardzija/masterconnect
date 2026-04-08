/*
  # Add Direct Messaging Support

  1. Changes
    - Make threads.job_id nullable to allow chats without a job
    - Add thread_type column to distinguish between 'direct' and 'job' threads
    - Add unique constraint to prevent duplicate direct threads between same two users

  2. New Columns
    - thread_type (text, not null, default 'direct')
      - Values: 'direct' | 'job'
      - 'direct' = chat initiated from profile without a job
      - 'job' = chat initiated from a specific job

  3. Constraints
    - Unique constraint on (customer_id, pro_id) for direct threads
    - Prevents users from creating multiple direct conversations

  4. Security
    - RLS policies remain unchanged
    - Both participants can access their threads
*/

-- Make job_id nullable to allow direct messaging without a job
ALTER TABLE threads ALTER COLUMN job_id DROP NOT NULL;

-- Add thread_type column to distinguish direct vs job-based threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'threads' AND column_name = 'thread_type'
  ) THEN
    ALTER TABLE threads ADD COLUMN thread_type text NOT NULL DEFAULT 'direct';
    
    -- Add check constraint to ensure valid thread types
    ALTER TABLE threads ADD CONSTRAINT threads_thread_type_check 
      CHECK (thread_type IN ('direct', 'job'));
  END IF;
END $$;

-- Update existing threads to be 'job' type since they all have job_id
UPDATE threads SET thread_type = 'job' WHERE job_id IS NOT NULL;

-- Create unique index to prevent duplicate direct threads between same users
CREATE UNIQUE INDEX IF NOT EXISTS uniq_direct_thread_pair
  ON threads (LEAST(customer_id, pro_id), GREATEST(customer_id, pro_id))
  WHERE thread_type = 'direct' AND job_id IS NULL;