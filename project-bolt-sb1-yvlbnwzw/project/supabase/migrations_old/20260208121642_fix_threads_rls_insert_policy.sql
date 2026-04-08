/*
  # Fix Threads RLS INSERT Policy

  1. Changes
    - Drop the old restrictive "Only pros can create threads" policy
    - Create new policy "Thread participants can create threads"
      - Allows authenticated users to INSERT threads when they are one of the participants
      - Checks: auth.uid() = customer_id OR auth.uid() = pro_id
      - Works for both customers and pros creating conversations

  2. Security
    - Users can only create threads where they are a participant
    - Cannot create threads on behalf of other users
    - Works with active_role switching (customers and pros can both initiate conversations)
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Only pros can create threads" ON threads;

-- Create new policy allowing participants to create threads
CREATE POLICY "Thread participants can create threads"
  ON threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id OR auth.uid() = pro_id
  );