-- Automatically create thread_participants rows for both users when a thread is created.
-- This ensures both sender and receiver can find the thread in their messages list.

CREATE OR REPLACE FUNCTION create_thread_participants()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert for user1 (ignore if already exists)
  INSERT INTO thread_participants (thread_id, user_id)
  VALUES (NEW.id, NEW.user1_id)
  ON CONFLICT DO NOTHING;

  -- Insert for user2 (ignore if already exists)
  INSERT INTO thread_participants (thread_id, user_id)
  VALUES (NEW.id, NEW.user2_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_thread_created ON threads;
CREATE TRIGGER on_thread_created
  AFTER INSERT ON threads
  FOR EACH ROW EXECUTE FUNCTION create_thread_participants();

-- Backfill existing threads that are missing thread_participants rows
INSERT INTO thread_participants (thread_id, user_id)
SELECT t.id, t.user1_id
FROM threads t
WHERE NOT EXISTS (
  SELECT 1 FROM thread_participants tp
  WHERE tp.thread_id = t.id AND tp.user_id = t.user1_id
);

INSERT INTO thread_participants (thread_id, user_id)
SELECT t.id, t.user2_id
FROM threads t
WHERE NOT EXISTS (
  SELECT 1 FROM thread_participants tp
  WHERE tp.thread_id = t.id AND tp.user_id = t.user2_id
);
