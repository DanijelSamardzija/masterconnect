/*
  # Add Completion Request Fields to Jobs

  1. Changes to Jobs Table
    - Add `completion_requested` boolean to track if Pro has requested completion
    - Add `completion_requested_at` timestamp for when Pro made the request
    - Add `completion_request_dismissed_at` timestamp for when Customer dismissed the request
    - Defaults to false/null for backward compatibility

  2. Purpose
    - Allows Pros to request job completion
    - Customers can see and respond to completion requests
    - Prevents spam by tracking request state
    - Optional dismiss tracking for UX improvements

  3. Security
    - RLS policies already exist for job updates
    - No additional policies needed (enforced at application level)
*/

-- Add completion_requested boolean field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completion_requested'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completion_requested boolean DEFAULT false;
  END IF;
END $$;

-- Add completion_requested_at timestamp field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completion_requested_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completion_requested_at timestamptz;
  END IF;
END $$;

-- Add completion_request_dismissed_at timestamp field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completion_request_dismissed_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completion_request_dismissed_at timestamptz;
  END IF;
END $$;

-- Create index for efficient completion request queries
CREATE INDEX IF NOT EXISTS idx_jobs_completion_requested ON jobs(completion_requested) WHERE completion_requested = true;
