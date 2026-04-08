/*
  # Allow Profile Reviews Without Job

  1. Changes to `reviews` table
    - Make `job_id` nullable (optional)
    - Update unique constraint to allow multiple reviews per user-pro pair (one per job + one for profile)

  2. Security Updates
    - Update INSERT policy to allow reviews with or without job_id
    - For job reviews: must have completed job
    - For profile reviews: must have an active thread (conversation) with the pro
    - Remove old policies and create new comprehensive ones

  3. Important Notes
    - Users can now leave one review per completed job AND one general profile review
    - Profile reviews require having messaged the pro at least once
    - Job reviews still require the job to be completed
*/

-- Make job_id nullable
ALTER TABLE reviews ALTER COLUMN job_id DROP NOT NULL;

-- Drop the old unique constraint on job_id
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_job_id_key;

-- Add new unique constraints
-- One review per job (if job_id is provided)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_job 
  ON reviews(job_id) 
  WHERE job_id IS NOT NULL;

-- One profile review per customer-pro pair (when job_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_profile 
  ON reviews(customer_id, pro_id) 
  WHERE job_id IS NULL;

-- Drop all old insert policies
DROP POLICY IF EXISTS "Customers can create reviews for their jobs" ON reviews;
DROP POLICY IF EXISTS "Customers can create reviews" ON reviews;

-- Create new comprehensive insert policy
CREATE POLICY "Customers can create reviews for jobs or profiles"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() 
    AND (
      -- Case 1: Review for a specific job (job must be completed and belong to customer)
      (
        job_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM jobs 
          WHERE jobs.id = job_id 
          AND jobs.customer_id = auth.uid()
          AND jobs.status = 'completed'
        )
      )
      OR
      -- Case 2: General profile review (must have had a conversation with the pro)
      (
        job_id IS NULL 
        AND EXISTS (
          SELECT 1 FROM threads 
          WHERE (threads.customer_id = auth.uid() AND threads.pro_id = pro_id)
             OR (threads.pro_id = auth.uid() AND threads.customer_id = pro_id)
        )
      )
    )
  );
