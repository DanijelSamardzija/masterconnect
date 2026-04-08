/*
  # Fix Reviews for Account Type System

  1. Changes
    - Update reviews RLS policies to work with new account_type system
    - Only customers can review professionals
    - Reviews require message exchange (thread_participants)
    - Remove dependency on old customer_id/pro_id columns in threads

  2. Security
    - Customer must have account_type = 'customer'
    - Professional must have account_type = 'professional'
    - Both must have exchanged messages (exist in thread_participants for same thread)
    - One review per customer-professional pair

  3. Important Notes
    - Reviews are customer → professional only
    - Must have active conversation history
    - Displayed on professional profiles and service listings
*/

-- Drop old insert policy
DROP POLICY IF EXISTS "Customers can create reviews for jobs or profiles" ON reviews;

-- Create new insert policy for account_type system
CREATE POLICY "Customers can review professionals they've messaged"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Reviewer must be authenticated user
    customer_id = auth.uid() 
    -- Reviewer must be a customer
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.account_type = 'customer'
    )
    -- Reviewee must be a professional
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = pro_id 
      AND profiles.account_type = 'professional'
    )
    -- Must have exchanged messages (both in same thread)
    AND EXISTS (
      SELECT 1 FROM thread_participants tp1
      JOIN thread_participants tp2 ON tp1.thread_id = tp2.thread_id
      WHERE tp1.user_id = auth.uid()
        AND tp2.user_id = pro_id
        AND tp1.user_id != tp2.user_id
    )
  );

-- Update unique constraint to be per customer-pro pair (no job_id dependency)
DROP INDEX IF EXISTS reviews_unique_profile;
DROP INDEX IF EXISTS reviews_unique_job;

-- One review per customer-professional pair
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_customer_pro 
  ON reviews(customer_id, pro_id);

-- Make sure job_id stays nullable since we don't need it anymore
ALTER TABLE reviews ALTER COLUMN job_id DROP NOT NULL;
