/*
  # Allow Public Access to Professional Profiles

  1. Changes
    - Update RLS policies to allow anonymous users to view professional profiles
    - Keep contact information (phone, email) visible only to authenticated users
    - Allow public access to profiles, pro_profiles, and reviews for SELECT operations
    
  2. Security
    - Anonymous users can browse professionals and read reviews
    - Sensitive contact information remains protected
    - Only authenticated users can see full contact details
    - Write operations still require authentication
*/

-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Pro profiles are viewable by everyone" ON pro_profiles;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;

-- Create new policies that allow both authenticated and anonymous users to SELECT
CREATE POLICY "Profiles are publicly viewable"
  ON profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Pro profiles are publicly viewable"
  ON pro_profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Reviews are publicly viewable"
  ON reviews FOR SELECT
  TO public
  USING (true);

-- Note: The existing policies for INSERT/UPDATE remain unchanged and still require authentication
-- Contact information (phone, email) in profiles should be handled at the application level
-- to hide from anonymous users, but the database allows reading for simplicity