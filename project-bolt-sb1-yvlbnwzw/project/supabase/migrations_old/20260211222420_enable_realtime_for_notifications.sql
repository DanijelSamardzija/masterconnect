/*
  # Enable Realtime for Notifications Table
  
  1. Changes
    - Enable Realtime replication for notifications table
    - This allows real-time subscriptions to work properly via WebSocket
    
  2. Security
    - Realtime respects existing RLS policies
    - Only users with SELECT access will receive real-time updates
*/

-- Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
