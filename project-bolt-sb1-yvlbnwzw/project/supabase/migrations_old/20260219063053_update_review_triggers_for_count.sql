/*
  # Update Review Triggers to Include Count
  
  1. Changes
    - Modify update_user_average_rating function to also update review_count
    - This ensures both average_rating and review_count stay in sync
    
  2. Notes
    - Triggers on reviews table will now update both fields automatically
    - No breaking changes - just extends existing functionality
*/

-- Update function to calculate both average rating and review count
CREATE OR REPLACE FUNCTION update_user_average_rating(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  review_cnt INTEGER;
BEGIN
  SELECT 
    AVG(rating)::DECIMAL(3,2),
    COUNT(*)::INTEGER
  INTO avg_rating, review_cnt
  FROM reviews
  WHERE pro_id = user_uuid;

  UPDATE profiles
  SET 
    average_rating = avg_rating,
    review_count = COALESCE(review_cnt, 0)
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate for all users with reviews
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
