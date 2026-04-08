/*
  # Allow Public Access to Jobs

  1. Changes
    - Update RLS policy to allow anonymous users to view jobs
    - This allows browsing available jobs without authentication
    
  2. Security
    - Anonymous users can browse open jobs
    - Write operations still require authentication
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Jobs are viewable by authenticated users" ON jobs;

-- Create new policy that allows both authenticated and anonymous users to SELECT
CREATE POLICY "Jobs are publicly viewable"
  ON jobs FOR SELECT
  TO public
  USING (true);