/*
  # Enforce Role-Based Permissions

  1. Changes
    - Jobs can only be created by CUSTOMERS
    - Jobs can only be viewed by PROS (professionals who can apply/message)
    - Job images follow job permissions
    - Messages remain restricted to thread participants only
    - Threads remain restricted to participants only
    
  2. Security
    - CUSTOMERS cannot browse or apply to jobs (they create them)
    - PROS cannot create jobs (they respond to them)
    - Thread messages are only visible to the customer and pro in that thread
    - Phone numbers will be handled at application level based on thread existence

  3. Notes
    - This enforces a clear separation: customers post jobs, pros respond
    - All role checks use the profiles.role column
*/

-- Drop existing public job access policy
DROP POLICY IF EXISTS "Jobs are publicly viewable" ON jobs;

-- Drop existing job insert policy to add role check
DROP POLICY IF EXISTS "Customers can insert own jobs" ON jobs;

-- Create role-based job policies
CREATE POLICY "Only customers can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'CUSTOMER'
    )
  );

CREATE POLICY "Only pros can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'PRO'
    )
  );

CREATE POLICY "Customers can view their own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'CUSTOMER'
    )
  );

-- Update job images to follow role-based access
DROP POLICY IF EXISTS "Job images are viewable by authenticated users" ON job_images;

CREATE POLICY "Job images viewable by pros"
  ON job_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'PRO'
    )
  );

CREATE POLICY "Job images viewable by job owner"
  ON job_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_images.job_id 
      AND jobs.customer_id = auth.uid()
    )
  );

-- Update thread creation to enforce role check
DROP POLICY IF EXISTS "Pros can create threads" ON threads;

CREATE POLICY "Only pros can create threads"
  ON threads FOR INSERT
  TO authenticated
  WITH CHECK (
    pro_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'PRO'
    )
  );