/*
  # Add Social Post Type and Universal Permissions

  ## Overview
  This migration adds 'social_post' as a valid post type and updates RLS policies
  to allow ALL authenticated users (both professionals and customers) to create
  social posts from the main feed.

  ## Changes
  
  ### 1. Update post_type CHECK Constraint
  - Add 'social_post' to the list of valid post types
  - Existing types: portfolio_post, hiring_post, service_request, job_seeker_post
  - New type: social_post
  
  ### 2. Update RLS Policies
  - Allow ALL authenticated users to create social_post
  - Professionals can create: portfolio_post, hiring_post, social_post
  - Customers can create: service_request, job_seeker_post, social_post
  
  ## Security
  - RLS remains enabled on posts table
  - All users must be authenticated to create posts
  - Role-based restrictions still apply for non-social post types
  - Social posts are available for everyone to create
  
  ## Notes
  - This enables the Feed feature where all users can share social content
  - Marketplace posts (hiring, service_request, job_seeker) remain role-restricted
  - No data migration needed as social_post is a new type
*/

-- Step 1: Drop the existing CHECK constraint on post_type
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_post_type_check;

-- Step 2: Add new CHECK constraint that includes 'social_post'
ALTER TABLE posts 
ADD CONSTRAINT posts_post_type_check 
CHECK (post_type IN ('portfolio_post', 'hiring_post', 'service_request', 'job_seeker_post', 'social_post'));

-- Step 3: Drop old RLS policies for posts INSERT
DROP POLICY IF EXISTS "Role-based post creation for professionals" ON posts;
DROP POLICY IF EXISTS "Role-based post creation for customers" ON posts;

-- Step 4: Create new RLS policies that allow social_post for everyone
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
    post_type IN ('portfolio_post', 'hiring_post', 'social_post')
  );

CREATE POLICY "Customers can create customer and social posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'customer'
    ) AND
    post_type IN ('service_request', 'job_seeker_post', 'social_post')
  );

-- Step 5: Update the UPDATE policy to allow social_post modifications
DROP POLICY IF EXISTS "Role-based post updates for professionals" ON posts;
DROP POLICY IF EXISTS "Role-based post updates for customers" ON posts;

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
    post_type IN ('portfolio_post', 'hiring_post', 'social_post')
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'professional'
    ) AND
    post_type IN ('portfolio_post', 'hiring_post', 'social_post')
  );

CREATE POLICY "Customers can update their customer and social posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'customer'
    ) AND
    post_type IN ('service_request', 'job_seeker_post', 'social_post')
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'customer'
    ) AND
    post_type IN ('service_request', 'job_seeker_post', 'social_post')
  );
