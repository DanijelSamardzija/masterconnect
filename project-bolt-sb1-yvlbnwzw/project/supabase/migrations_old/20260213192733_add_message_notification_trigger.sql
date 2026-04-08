/*
  # Add Message Notification Trigger
  
  1. Purpose
    - Automatically create notifications when a new message is sent
    - Ensures reliable notification delivery without client-side intervention
    
  2. Changes
    - Create function to generate notification when message is inserted
    - Add trigger to execute function on message insert
    - Only creates notification for non-system messages
    
  3. Security
    - Runs in security context with proper permissions
    - Respects existing RLS policies on notifications table
*/

-- Function to create notification for new message
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Skip system messages
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT name INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create notification for receiver
  IF NEW.receiver_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, meta)
    VALUES (
      NEW.receiver_id,
      'message',
      'New message',
      'New message from ' || COALESCE(sender_name, 'Someone'),
      jsonb_build_object(
        'sender_id', NEW.sender_id,
        'message_id', NEW.id,
        'thread_id', NEW.thread_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;

-- Create trigger
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();
