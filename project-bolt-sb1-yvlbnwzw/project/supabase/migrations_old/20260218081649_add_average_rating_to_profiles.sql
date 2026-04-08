/*
  # Add average rating support to profiles

  1. Changes
    - Add `average_rating` column to profiles table
    - Create function to calculate average rating from reviews
    - Create trigger to automatically update average rating when reviews change

  2. Notes
    - Average rating is calculated from the `rating` field in `reviews` table where pro_id matches
    - Updates automatically when reviews are added, updated, or deleted
*/

-- Add average_rating column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'average_rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN average_rating DECIMAL(3,2) DEFAULT NULL;
  END IF;
END $$;

-- Function to calculate and update average rating for a professional
CREATE OR REPLACE FUNCTION update_user_average_rating(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  SELECT AVG(rating)::DECIMAL(3,2)
  INTO avg_rating
  FROM reviews
  WHERE pro_id = user_uuid;

  UPDATE profiles
  SET average_rating = avg_rating
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to update average rating when reviews change
CREATE OR REPLACE FUNCTION trigger_update_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_user_average_rating(OLD.pro_id);
  ELSE
    PERFORM update_user_average_rating(NEW.pro_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_average_rating_on_review_change ON reviews;

CREATE TRIGGER update_average_rating_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_average_rating();

-- Calculate initial average ratings for all existing users with reviews
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT pro_id FROM reviews
  LOOP
    PERFORM update_user_average_rating(user_record.pro_id);
  END LOOP;
END $$;
