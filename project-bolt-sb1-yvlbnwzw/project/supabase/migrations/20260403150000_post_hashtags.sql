-- Add hashtags array column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}';

-- GIN index for fast hashtag filtering
CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON posts USING GIN(hashtags);
