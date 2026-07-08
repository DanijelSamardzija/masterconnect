-- Fix update_profile_rating: add SECURITY DEFINER so RLS doesn't block the
-- profile UPDATE when a different user inserts/updates/deletes a review.
-- Also add UPDATE to trigger so edits to existing reviews recalculate averages.

CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = OLD.pro_id),
      review_count   = (SELECT COUNT(*)    FROM reviews WHERE pro_id = OLD.pro_id)
    WHERE id = OLD.pro_id;
  ELSE
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = NEW.pro_id),
      review_count   = (SELECT COUNT(*)    FROM reviews WHERE pro_id = NEW.pro_id)
    WHERE id = NEW.pro_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate trigger to also fire on UPDATE (review edits)
DROP TRIGGER IF EXISTS update_rating_after_review ON reviews;
CREATE TRIGGER update_rating_after_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_profile_rating();

-- Add missing UPDATE policy so users can edit their own reviews
DROP POLICY IF EXISTS "Customers can update own reviews" ON reviews;
CREATE POLICY "Customers can update own reviews" ON reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);
