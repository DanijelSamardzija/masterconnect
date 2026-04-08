/*
  # Add social_post Type and Update Role-Based Post Creation Rules

  ## Summary
  This migration adds the `social_post` type to the posts table and updates RLS policies to enforce strict role-based post creation rules.

  ## Changes

  ### 1. Post Type Changes
  - Add `social_post` to the allowed post types CHECK constraint
  - This allows ALL users (both professionals and customers) to create social posts

  ### 2. Updated Post Types by Account Type

  **Professionals can create:**
  - `portfolio_post` - Showcase their work
  - `hiring_post` - Post jobs when they need to hire
  - `social_post` - General social content

  **Customers can create:**
  - `service_request` - Request services from professionals
  - `job_seeker_post` - Post when looking for work
  - `social_post` - General social content

  ### 3. RLS Policy Updates
  - Drop permissive policies that allowed any post_type
  - Create strict INSERT and UPDATE policies that enforce account_type rules
  - Customers CANNOT create portfolio_post or hiring_post
  - Professionals CANNOT create service_request or job_seeker_post
  - Both can create social_post

  ### 4. Security
  - Database-level enforcement via CHECK constraints
  - Application-level enforcement via RLS policies
  - Both INSERT and UPDATE operations are protected

  ## Important Notes
  - The social_post type is for general social content (text, images, videos)
  - All other post types are for marketplace functionality
  - RLS policies now check both auth.uid() AND account_type for strict enforcement
*/

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;

-- Step 2: Add new CHECK constraint with social_post
ALTER TABLE posts
ADD CONSTRAINT posts_post_type_check
CHECK (post_type IN ('portfolio_post', 'hiring_post', 'service_request', 'job_seeker_post', 'social_post'));

-- Step 3: Drop old permissive RLS policies
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;

-- Step 4: Create strict role-based INSERT policy
CREATE POLICY "Role-based post creation"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Professionals can create portfolio_post, hiring_post, and social_post
      (
        post_type IN ('portfolio_post', 'hiring_post', 'social_post') AND
        (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'professional'
      )
      OR
      -- Customers can create service_request, job_seeker_post, and social_post
      (
        post_type IN ('service_request', 'job_seeker_post', 'social_post') AND
        (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'customer'
      )
    )
  );

-- Step 5: Create strict role-based UPDATE policy
CREATE POLICY "Role-based post updates"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Professionals can update portfolio_post, hiring_post, and social_post
      (
        post_type IN ('portfolio_post', 'hiring_post', 'social_post') AND
        (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'professional'
      )
      OR
      -- Customers can update service_request, job_seeker_post, and social_post
      (
        post_type IN ('service_request', 'job_seeker_post', 'social_post') AND
        (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'customer'
      )
    )
  );
