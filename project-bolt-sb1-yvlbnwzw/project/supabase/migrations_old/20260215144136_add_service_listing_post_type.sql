/*
  # Add service_listing post type
  
  ## Overview
  This migration adds 'service_listing' as a valid post type for professionals
  to advertise their services with pricing information.
  
  ## Changes
  
  ### 1. Update post_type CHECK Constraint
  - Add 'service_listing' to the list of valid post types
  - Existing types: portfolio_post, hiring_post, service_request, job_seeker_post, social_post
  - New type: service_listing (for professionals to list their services)
  
  ### 2. Update RLS Policies
  - Allow professionals to create service_listing posts
  - Customers cannot create service_listing posts (they create service_request instead)
  
  ## Security
  - RLS remains enabled on posts table
  - Only professionals can create service_listing posts
  - service_listing posts are public and visible to all authenticated users
  
  ## Notes
  - service_listing includes: job_title, category, city, price_type, price_value
  - This is different from service_request (which is customers asking for services)
  - service_listing is for professionals advertising their services
*/

-- Step 1: Drop the existing CHECK constraint on post_type
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_post_type_check;

-- Step 2: Add new CHECK constraint that includes 'service_listing'
ALTER TABLE posts 
ADD CONSTRAINT posts_post_type_check 
CHECK (post_type IN ('portfolio_post', 'hiring_post', 'service_request', 'job_seeker_post', 'social_post', 'service_listing'));

-- Step 3: Update RLS policies for professionals to include service_listing
DROP POLICY IF EXISTS "Professionals can create professional and social posts" ON posts;

CREATE POLICY "Professionals can create professional and social posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'professional'
    ) AND
    post_type IN ('portfolio_post', 'hiring_post', 'social_post', 'service_listing')
  );

-- Step 4: Update RLS policy for professionals UPDATE to include service_listing
DROP POLICY IF EXISTS "Professionals can update their professional and social posts" ON posts;

CREATE POLICY "Professionals can update their professional and social posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'professional'
    ) AND
    post_type IN ('portfolio_post', 'hiring_post', 'social_post', 'service_listing')
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'professional'
    ) AND
    post_type IN ('portfolio_post', 'hiring_post', 'social_post', 'service_listing')
  );

-- Step 5: Update DELETE policy for professionals to include service_listing
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
