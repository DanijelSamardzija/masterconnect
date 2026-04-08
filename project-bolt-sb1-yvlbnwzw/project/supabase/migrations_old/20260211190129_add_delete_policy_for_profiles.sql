/*
  # Add Delete Policy for Profiles

  1. Changes
    - Add DELETE policy to profiles table so users can delete their own profiles
    - This is required for the account deletion feature to work properly
*/

-- Add DELETE policy for profiles table
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
