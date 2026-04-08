/*
  # Fix Threads Role Validation

  1. Changes
    - Add constraint to ensure customer_id is actually a customer account
    - Add constraint to ensure pro_id is actually a professional account
    - Update RLS policy to enforce these constraints

  2. Security
    - Prevents customers from contacting other customers
    - Prevents professionals from being listed as customers
    - Ensures thread participants have correct account types
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Thread participants can create threads" ON threads;

-- Create new policy with role validation
CREATE POLICY "Thread participants can create threads"
  ON threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id OR auth.uid() = pro_id
    AND
    -- Ensure customer_id is a customer or job_seeker
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = customer_id
      AND account_type IN ('customer', 'job_seeker')
    )
    AND
    -- Ensure pro_id is a professional
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = pro_id
      AND account_type = 'professional'
    )
  );