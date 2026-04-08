/*
  # Restructure to Account Types

  ## Overview
  This migration restructures the system from switchable roles to fixed account types.
  Users can no longer switch between roles - they must choose one account type.

  ## Changes

  1. Profile Changes
    - Remove `roles` array column
    - Remove `active_role` column
    - Add `account_type` column (professional or customer)
    - Add `is_admin` boolean for admin users
    - Convert existing users to appropriate account type

  2. Post Type Changes
    - Add `post_type` column to posts table
    - Post types: portfolio_post, hiring_post, service_request, job_seeker_post
    - portfolio_post: Professional showcasing their work
    - hiring_post: Professional looking for workers
    - service_request: Customer requesting a service
    - job_seeker_post: Customer looking for work

  3. RLS Policy Updates
    - Update all policies to use account_type and is_admin
    - Ensure proper access control based on account type

  ## Migration Strategy
  - Existing users with 'pro' role become 'professional'
  - Existing users with 'customer' or 'job_seeker' role become 'customer'
  - Users with 'admin' in roles become is_admin = true
*/

-- Step 1: Add new columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('professional', 'customer'));

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Step 2: Migrate existing users based on their active_role
UPDATE profiles 
SET account_type = CASE 
  WHEN active_role = 'pro' THEN 'professional'
  WHEN active_role = 'job_seeker' THEN 'customer'
  ELSE 'customer'
END
WHERE account_type IS NULL;

-- Step 3: Migrate admin users
UPDATE profiles 
SET is_admin = true
WHERE roles ? 'admin';

-- Step 4: Make account_type NOT NULL after migration
ALTER TABLE profiles 
ALTER COLUMN account_type SET NOT NULL;

-- Step 5: Drop old admin policies that depend on roles column
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
DROP POLICY IF EXISTS "Admins can update all reports" ON reports;

-- Step 6: Drop old columns
ALTER TABLE profiles 
DROP COLUMN IF EXISTS roles,
DROP COLUMN IF EXISTS active_role;

-- Step 7: Recreate admin policies using is_admin
CREATE POLICY "Admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Step 8: Update the profile creation trigger
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, account_type, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'customer', -- Default to customer
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Add post_type to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS post_type text CHECK (post_type IN ('portfolio_post', 'hiring_post', 'service_request', 'job_seeker_post'));

-- Step 10: Update existing posts to have default post_type based on user account
UPDATE posts p
SET post_type = CASE 
  WHEN pr.account_type = 'professional' THEN 'portfolio_post'
  ELSE 'service_request'
END
FROM profiles pr
WHERE p.user_id = pr.id AND p.post_type IS NULL;

-- Step 11: Make post_type NOT NULL
ALTER TABLE posts 
ALTER COLUMN post_type SET NOT NULL;

-- Step 12: Update RLS policies for profiles

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND account_type = (SELECT account_type FROM profiles WHERE id = auth.uid())
  );

-- Step 13: Update RLS policies for posts

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view non-deleted posts" ON posts;
DROP POLICY IF EXISTS "Users can view posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can soft delete their own posts" ON posts;

-- Create new policies
CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create posts based on account type"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (post_type IN ('portfolio_post', 'hiring_post') AND 
       (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'professional')
      OR
      (post_type IN ('service_request', 'job_seeker_post') AND 
       (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'customer')
    )
  );

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (post_type IN ('portfolio_post', 'hiring_post') AND 
       (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'professional')
      OR
      (post_type IN ('service_request', 'job_seeker_post') AND 
       (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'customer')
    )
  );

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 14: Update jobs table policies

-- Drop old job policies
DROP POLICY IF EXISTS "Anyone can view active jobs" ON jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Pros can create jobs" ON jobs;
DROP POLICY IF EXISTS "Professionals can post jobs (hiring)" ON jobs;
DROP POLICY IF EXISTS "Customers can post jobs (service requests)" ON jobs;
DROP POLICY IF EXISTS "Customers can create jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;

-- Create new job policies
CREATE POLICY "Anyone can view active jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (status != 'deleted');

CREATE POLICY "All users can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Step 15: Update reviews to only allow reviews for professionals

-- Drop old review policies
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews for completed jobs" ON reviews;
DROP POLICY IF EXISTS "Users can review professionals for completed jobs" ON reviews;

-- Create new review policies
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can review professionals"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND (SELECT account_type FROM profiles WHERE id = pro_id) = 'professional'
    AND EXISTS (
      SELECT 1 FROM jobs 
      WHERE id = job_id 
      AND status = 'completed'
      AND customer_id = auth.uid()
    )
  );
