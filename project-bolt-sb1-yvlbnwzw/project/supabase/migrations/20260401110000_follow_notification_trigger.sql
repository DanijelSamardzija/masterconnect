/*
  # Follow Notification Trigger
  Notifies a user when someone starts following them.
  Anti-spam: max 1 notification per follower+following pair per 24h.
*/

CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
DECLARE
  v_follower_name text;
BEGIN
  -- Skip if following yourself (shouldn't happen, but guard anyway)
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  -- Deduplicate: skip if already notified within 24h
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id     = NEW.following_id
      AND action_type = 'new_follower'
      AND (meta->>'follower_id')::uuid = NEW.follower_id
      AND created_at  > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_follower_name FROM profiles WHERE id = NEW.follower_id;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    NEW.following_id,
    'follow',
    'new_follower',
    COALESCE(v_follower_name, 'Neko') || ' vas je zapratio',
    'Imate novog pratioca',
    jsonb_build_object('follower_id', NEW.follower_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_follower ON followers;
CREATE TRIGGER trigger_notify_new_follower
  AFTER INSERT ON followers
  FOR EACH ROW EXECUTE FUNCTION notify_new_follower();
