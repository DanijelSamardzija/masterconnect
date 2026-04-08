/*
  # Add Threaded Comments Support

  1. Changes
    - Add `parent_comment_id` column to `post_comments` table
      - Nullable field that references another comment in the same table
      - When null: top-level comment
      - When not null: reply to the parent comment
    
  2. Constraints
    - Foreign key constraint to ensure parent comment exists
    - Prevent self-referencing (comment cannot be its own parent)
    
  3. Security
    - No RLS policy changes needed (existing policies cover replies)
*/

-- Add parent_comment_id column to support threaded comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_comments' AND column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE post_comments 
    ADD COLUMN parent_comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE;
    
    -- Add index for better query performance when fetching replies
    CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id 
    ON post_comments(parent_comment_id);
    
    -- Add check constraint to prevent self-referencing
    ALTER TABLE post_comments 
    ADD CONSTRAINT check_not_self_parent 
    CHECK (id != parent_comment_id);
  END IF;
END $$;