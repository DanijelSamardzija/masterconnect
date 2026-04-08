/*
  # Clean Up Duplicate Posts RLS Policies

  ## Overview
  Remove all duplicate and conflicting RLS policies on the posts table
  and keep only the most current, clear policies.

  ## Changes
  
  ### 1. Remove All Existing Policies
  Drop all current policies to ensure clean state
  
  ### 2. Create Clean, Simple Policies
  - SELECT: Anyone authenticated can view all posts
  - INSERT: Role-based creation (professionals + customers with social_post)
  - UPDATE: Users can update their own posts (with role restrictions)
  - DELETE: Users can delete their own posts
  
  ## Security
  - RLS remains enabled
  - All users must be authenticated
  - Role-based restrictions apply correctly
  - Social posts available to all account types
*/

-- Step 1: Drop ALL existing policies on posts table
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users can view all posts" ON posts;
DROP POLICY IF EXISTS "Users can view posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view non-deleted posts" ON posts;

DROP POLICY IF EXISTS "Professionals can create professional and social posts" ON posts;
DROP POLICY IF EXISTS "Customers can create customer and social posts" ON posts;
DROP POLICY IF EXISTS "Role-based post creation" ON posts;
DROP POLICY IF EXISTS "Users can create posts based on account type" ON posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;

DROP POLICY IF EXISTS "Professionals can update their professional and social posts" ON posts;
DROP POLICY IF EXISTS "Customers can update their customer and social posts" ON posts;
DROP POLICY IF EXISTS "Role-based post updates" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;

DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- Step 2: Create clean SELECT policy
CREATE POLICY "Anyone authenticated can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Create clean INSERT policy for professionals
CREATE POLICY "Professionals can insert posts"
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

-- Step 4: Create clean INSERT policy for customers
CREATE POLICY "Customers can insert posts"
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

-- Step 5: Create clean UPDATE policy for professionals
CREATE POLICY "Professionals can update posts"
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

-- Step 6: Create clean UPDATE policy for customers
CREATE POLICY "Customers can update posts"
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

-- Step 7: Create clean DELETE policy
CREATE POLICY "Users can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
