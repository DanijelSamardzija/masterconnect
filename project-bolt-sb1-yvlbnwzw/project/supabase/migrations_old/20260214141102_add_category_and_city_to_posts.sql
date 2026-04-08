/*
  # Add category and city columns to posts table

  1. Changes
    - Add `category` column to posts table (required for all marketplace posts)
    - Add `city` column to posts table (required for all marketplace posts)
    - Add indexes for better filtering performance

  2. Purpose
    - Enable filtering posts by category and city
    - Store category and city information for all post types
*/

-- Add category column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS category text;

-- Add city column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS city text;

-- Create indexes for better filtering performance
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_city ON posts(city) WHERE city IS NOT NULL;

-- Migrate existing data: copy profession to category where applicable
UPDATE posts
SET category = profession
WHERE profession IS NOT NULL AND category IS NULL;

-- Migrate existing data: copy location to city where applicable
UPDATE posts
SET city = location
WHERE location IS NOT NULL AND city IS NULL;