/*
  # Add post_id to threads table

  1. Changes
    - Add `post_id` column to threads table with foreign key to posts
    - Update thread_type check constraint to include 'post' type
    - Add index on post_id for better query performance
  
  2. Notes
    - Allows threads to be associated with marketplace posts
    - Enables tracking which threads are related to specific job/service posts
*/

-- Add post_id column to threads
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES posts(id) ON DELETE CASCADE;

-- Drop old check constraint
ALTER TABLE threads 
DROP CONSTRAINT IF EXISTS threads_thread_type_check;

-- Add new check constraint with 'post' type included
ALTER TABLE threads
ADD CONSTRAINT threads_thread_type_check 
CHECK (thread_type = ANY (ARRAY['direct'::text, 'job'::text, 'post'::text]));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_threads_post_id ON threads(post_id);

-- Add comment
COMMENT ON COLUMN threads.post_id IS 'References the marketplace post this thread is about (for Apply functionality)';
