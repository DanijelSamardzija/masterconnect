/*
  # Allow Public Access to Service Listings
  
  1. Changes
    - Add public read access for service_listing posts
    - Add public read access for service_listing post media
    - Add public read access for profiles (for service provider info)
    - Add public read access for post reactions and comments on service listings
    
  2. Security
    - Only SELECT (read) operations are public
    - Write operations still require authentication
    - Only service_listing post type is publicly visible
*/

-- Allow anyone (authenticated or not) to view service listing posts
DROP POLICY IF EXISTS "Public can view service listings" ON posts;
CREATE POLICY "Public can view service listings"
  ON posts FOR SELECT
  USING (post_type = 'service_listing' AND is_active = true);

-- Keep authenticated policy for all other posts
DROP POLICY IF EXISTS "Authenticated users can view all posts" ON posts;
CREATE POLICY "Authenticated users can view all posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

-- Allow public access to post media for service listings
DROP POLICY IF EXISTS "Public can view service listing media" ON post_media;
CREATE POLICY "Public can view service listing media"
  ON post_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_media.post_id 
      AND posts.post_type = 'service_listing'
      AND posts.is_active = true
    )
  );

-- Keep authenticated policy for all other post media
DROP POLICY IF EXISTS "Authenticated users can view post media" ON post_media;
CREATE POLICY "Authenticated users can view post media"
  ON post_media FOR SELECT
  TO authenticated
  USING (true);

-- Allow public access to profiles (for service provider info on discover page)
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
CREATE POLICY "Public can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Allow public to view reactions on service listings
DROP POLICY IF EXISTS "Public can view service listing reactions" ON post_reactions;
CREATE POLICY "Public can view service listing reactions"
  ON post_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_reactions.post_id 
      AND posts.post_type = 'service_listing'
      AND posts.is_active = true
    )
  );

-- Keep authenticated policy for all other reactions
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON post_reactions;
CREATE POLICY "Authenticated users can view reactions"
  ON post_reactions FOR SELECT
  TO authenticated
  USING (true);

-- Allow public to view comments on service listings
DROP POLICY IF EXISTS "Public can view service listing comments" ON post_comments;
CREATE POLICY "Public can view service listing comments"
  ON post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_comments.post_id 
      AND posts.post_type = 'service_listing'
      AND posts.is_active = true
    )
  );

-- Keep authenticated policy for all other comments
DROP POLICY IF EXISTS "Authenticated users can view comments" ON post_comments;
CREATE POLICY "Authenticated users can view comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (true);

-- Allow public to view reviews (for ratings on service listings)
DROP POLICY IF EXISTS "Public can view reviews" ON reviews;
CREATE POLICY "Public can view reviews"
  ON reviews FOR SELECT
  USING (true);
