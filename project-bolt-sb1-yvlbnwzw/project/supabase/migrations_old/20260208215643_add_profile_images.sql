/*
  # Add Profile Images
  
  1. Changes
    - Add `avatar_url` column to profiles table for storing user avatar images
    - Add `cover_url` column to profiles table for storing profile cover images
  
  2. Notes
    - Both columns are nullable (optional)
    - URLs will reference Supabase Storage objects
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN cover_url text;
  END IF;
END $$;