/*
  # Allow public access to published social posts

  1. Changes
    - Add RLS policy to allow anonymous (public) users to view published social_post entries
    - This enables the feed to work for guests without requiring login
  
  2. Security
    - Only published social posts are visible to public
    - shadow_hidden, shadow_limited, and removed posts remain invisible to anonymous users
    - Authenticated users can still see their own posts regardless of status (existing policies)
*/

-- Drop policy if it exists to avoid duplicates
DROP POLICY IF EXISTS "Public can view published social posts" ON posts;

-- Allow public/anonymous users to view published social posts
CREATE POLICY "Public can view published social posts"
  ON posts
  FOR SELECT
  TO public
  USING (
    post_type = 'social_post' 
    AND status = 'published'
  );
