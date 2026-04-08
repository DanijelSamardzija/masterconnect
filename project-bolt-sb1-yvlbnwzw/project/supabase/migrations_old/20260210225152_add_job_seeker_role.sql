/*
  # Add Job Seeker Role
  
  This migration adds support for a third user role: 'job_seeker'
  
  ## Changes
  
  1. Role System Update
    - Add 'job_seeker' as a valid role alongside 'customer' and 'pro'
    - Job Seekers are professionals looking for employment (not project work)
    
  2. User Flow
    - **Customer/Employer**: Posts jobs (project-based) OR employment opportunities
    - **Pro/Service Provider**: Offers services, applies to project jobs
    - **Job Seeker**: Looking for employment, applies to employment opportunities
    
  3. Security
    - All existing RLS policies support the new role
    - Job seekers can be contacted via messages
    
  ## Notes
  - This enables global marketplace with 3 distinct user types
  - Users can switch between roles as needed
  - All roles can communicate through the messaging system
*/

-- No changes needed to the profiles table structure
-- The roles array already supports any string values
-- Just documenting the new role for clarity

-- Add a comment to document valid roles
COMMENT ON COLUMN profiles.roles IS 'Array of user roles: customer (posts jobs/hires), pro (offers services), job_seeker (seeks employment)';
COMMENT ON COLUMN profiles.active_role IS 'Currently active role: customer, pro, or job_seeker';
