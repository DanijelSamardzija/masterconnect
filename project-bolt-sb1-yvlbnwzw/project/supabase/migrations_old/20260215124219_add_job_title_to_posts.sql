/*
  # Add job title to posts

  1. Changes
    - Add `job_title` column to posts table for hiring posts
    - This field will store the job position title for hiring_post type posts
    - Optional field (NULL allowed) since not all post types need it
*/

-- Add job_title column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS job_title text;

-- Add comment to explain the column
COMMENT ON COLUMN posts.job_title IS 'Job position title for hiring_post type posts';
