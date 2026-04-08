/*
  # Add is_active Field to Posts Table
  
  ## Overview
  This migration adds the `is_active` field to the posts table to support
  soft-deleting and hiding posts without actually removing them from the database.
  
  ## Changes
  
  ### 1. Add is_active Column
  - Add `is_active` boolean column with default value TRUE
  - All existing posts will be marked as active by default
  
  ## Notes
  - is_active = true means the post is visible and active
  - is_active = false means the post is hidden/deactivated (soft delete)
  - This allows posts to be hidden without losing data or breaking foreign key relationships
*/

-- Add is_active column with default value TRUE
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- Create index for better query performance when filtering by is_active
CREATE INDEX IF NOT EXISTS idx_posts_is_active ON posts(is_active);