/*
  # Add Job Type Field
  
  This migration adds support for differentiating between project-based jobs and employment opportunities.
  
  ## Changes
  
  1. Jobs Table Update
    - Add `job_type` column: 'project' (default) or 'employment'
    - 'project' = One-time job, contractors/pros apply
    - 'employment' = Long-term position, job seekers apply
    
  2. Use Cases
    - **Project Jobs**: "Fix my plumbing", "Paint my house" - completed in days/weeks
    - **Employment**: "Hiring 5 electricians for 6 months", "Need full-time carpenter"
    
  3. Security
    - Existing RLS policies work with both job types
    - All users can view both types
    - Only job poster can edit/delete
*/

-- Add job_type column with default 'project' for existing jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_type text DEFAULT 'project' CHECK (job_type IN ('project', 'employment'));
    
    COMMENT ON COLUMN jobs.job_type IS 'Type of job: project (one-time, for pros) or employment (long-term, for job seekers)';
  END IF;
END $$;
