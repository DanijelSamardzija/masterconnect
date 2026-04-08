/*
  # Add Policy for Participants to Update Message Status

  1. Changes
    - Adds RLS policy to allow thread participants (customers and pros) to update messages
    - Ensures both the customer and pro involved in a thread can update message delivery status
  
  2. Security
    - Policy restricts updates to only users who are participants in the thread
    - Uses UNION to check both customer_id and pro_id from the threads table
*/

DROP POLICY IF EXISTS "Allow participants to update message status" ON messages;

CREATE POLICY "Allow participants to update message status"
ON messages
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT customer_id FROM threads WHERE threads.id = messages.thread_id
    UNION
    SELECT pro_id FROM threads WHERE threads.id = messages.thread_id
  )
);