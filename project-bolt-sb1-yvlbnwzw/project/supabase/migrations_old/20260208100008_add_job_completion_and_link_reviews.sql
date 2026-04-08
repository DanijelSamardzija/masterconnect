/*
  # Add Job Completion and Review Linking

  1. Changes to Jobs Table
    - Modify status check constraint to include 'completed' value
    - Add `completed_at` timestamp column for tracking when job was marked complete
    - Only customers who created the job can mark it as completed

  2. Changes to Reviews Table
    - Add `job_id` column to link reviews to specific jobs
    - Add unique constraint to prevent multiple reviews for same job
    - Reviews can only be created after job is completed

  3. Security
    - Update RLS policies to enforce completion permissions
    - Ensure only customers can mark jobs as completed
    - Ensure reviews are only created after job completion
*/

-- Add completed_at column to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Update status check constraint to include 'completed'
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
  CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'completed'::text]));

-- Add job_id to reviews table to link reviews to specific jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE reviews ADD COLUMN job_id uuid REFERENCES jobs(id);
  END IF;
END $$;

-- Create unique constraint to prevent multiple reviews for same job
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reviews_job_id_customer_id_key'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_job_id_customer_id_key 
      UNIQUE (job_id, customer_id);
  END IF;
END $$;

-- Create index for efficient job completion queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_completed ON jobs(status) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews(job_id);

-- Update RLS policy for job updates to allow completion by customer
DROP POLICY IF EXISTS "Customers can update own jobs" ON jobs;
CREATE POLICY "Customers can update own jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Add RLS policy for review creation (must be customer, job must be completed)
DROP POLICY IF EXISTS "Customers can create reviews for completed jobs" ON reviews;
CREATE POLICY "Customers can create reviews for completed jobs"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_id 
      AND jobs.status = 'completed'
      AND jobs.customer_id = auth.uid()
    )
  );
