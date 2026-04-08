/*
  # Allow Anyone to Message Anyone

  1. Changes
    - Remove role-based restrictions from threads creation
    - Allow any authenticated user to create threads with any other user
    - No more restrictions on customer vs professional

  2. Security
    - Users can only create threads where they are one of the participants
    - Cannot create threads on behalf of other users
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Thread participants can create threads" ON threads;

-- Create new open policy - anyone can message anyone
CREATE POLICY "Anyone can create threads with anyone"
  ON threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id OR auth.uid() = pro_id
  );