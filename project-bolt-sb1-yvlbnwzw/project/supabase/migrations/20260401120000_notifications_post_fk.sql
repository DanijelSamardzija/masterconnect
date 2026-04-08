-- Add missing FK on notifications.post_id so PostgREST join works
ALTER TABLE notifications
  ADD CONSTRAINT notifications_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;
