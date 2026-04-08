/*
  # Add Review Count to Profiles
  
  1. Changes
    - Add review_count column to profiles table
    - Update existing profiles with current review counts
    
  2. Notes
    - Default value is 0 for profiles with no reviews
    - This will be updated when new reviews are added
*/

-- Add review_count column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'review_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN review_count integer DEFAULT 0;
  END IF;
END $$;

-- Update existing profiles with current review counts
UPDATE profiles
SET review_count = (
  SELECT COUNT(*)
  FROM reviews
  WHERE reviews.pro_id = profiles.id
)
WHERE account_type = 'professional';
