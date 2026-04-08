/*
  # Allow public access to media for published social posts

  1. Changes
    - Add RLS policy to allow anonymous (public) users to view media for published social_post entries
    - This enables guests to see images/videos in the feed
  
  2. Security
    - Only media from published social posts is visible to public
    - Media from shadow_hidden, shadow_limited, and removed posts remains invisible to anonymous users
    - Authenticated users can still see all post media (existing policy)
*/

-- Drop policy if it exists to avoid duplicates
DROP POLICY IF EXISTS "Public can view published social post media" ON post_media;

-- Allow public/anonymous users to view media for published social posts
CREATE POLICY "Public can view published social post media"
  ON post_media
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 
      FROM posts 
      WHERE posts.id = post_media.post_id 
        AND posts.post_type = 'social_post' 
        AND posts.status = 'published'
    )
  );
