-- Add views_count column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;

-- Function to safely increment views (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_post_views(post_id uuid)
RETURNS void AS $$
  UPDATE posts SET views_count = views_count + 1 WHERE id = post_id;
$$ LANGUAGE sql SECURITY DEFINER;
