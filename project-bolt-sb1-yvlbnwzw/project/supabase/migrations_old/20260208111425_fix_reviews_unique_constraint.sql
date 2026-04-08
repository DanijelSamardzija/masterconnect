/*
  # Fix Reviews Unique Constraint

  1. Changes
    - Drop existing composite unique constraint on (job_id, customer_id)
    - Add unique constraint on job_id only
    - This ensures each job can have only one review (from the customer)

  2. Reasoning
    - Each job should have exactly one review from the customer
    - A customer should not be able to leave multiple reviews for the same job
*/

-- Drop existing composite unique constraint
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_job_id_customer_id_key;

-- Add unique constraint on job_id only
ALTER TABLE reviews ADD CONSTRAINT reviews_job_id_key UNIQUE (job_id);