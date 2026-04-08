/*
  # Notification Triggers

  Activates automatic notifications for:
    - Post reactions (like/emoji)
    - Post comments
    - Comment replies
    - Comment reactions
    - Direct messages
    - Saved posts (new)

  Rules:
    - Never notify yourself (actor == author → skip)
    - No duplicate reaction notifications within 1 hour for the same actor+post
*/

-- ============================================================
-- 1. POST REACTION → notify post author
-- ============================================================
CREATE OR REPLACE FUNCTION notify_post_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_text      text;
  v_reactor_name   text;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text
  FROM posts WHERE id = NEW.post_id;

  -- Skip if reacting to own post
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Skip duplicate: same reactor+post reaction notification within 1 hour
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id     = v_post_author_id
      AND action_type = 'post_reaction'
      AND post_id     = NEW.post_id
      AND (meta->>'reactor_id')::uuid = NEW.user_id
      AND created_at  > now() - interval '1 hour'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (
    v_post_author_id,
    'reaction',
    'post_reaction',
    NEW.post_id,
    COALESCE(v_reactor_name, 'Neko') || ' je reagovao na vaš post',
    COALESCE(LEFT(v_post_text, 100), 'Vaš post'),
    jsonb_build_object(
      'post_id',    NEW.post_id,
      'reactor_id', NEW.user_id,
      'emoji',      NEW.emoji
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_post_reaction ON post_reactions;
CREATE TRIGGER trigger_notify_post_reaction
  AFTER INSERT ON post_reactions
  FOR EACH ROW EXECUTE FUNCTION notify_post_reaction();


-- ============================================================
-- 2. POST COMMENT / COMMENT REPLY → notify post author or parent commenter
-- ============================================================
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id       uuid;
  v_post_text            text;
  v_commenter_name       text;
  v_parent_author_id     uuid;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text
  FROM posts WHERE id = NEW.post_id;

  SELECT name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

  IF NEW.parent_comment_id IS NOT NULL THEN
    -- Reply: notify parent comment author
    SELECT user_id INTO v_parent_author_id
    FROM post_comments WHERE id = NEW.parent_comment_id;

    IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
      VALUES (
        v_parent_author_id,
        'reply',
        'comment_reply',
        NEW.post_id,
        COALESCE(v_commenter_name, 'Neko') || ' je odgovorio na vaš komentar',
        LEFT(NEW.text, 100),
        jsonb_build_object(
          'post_id',           NEW.post_id,
          'comment_id',        NEW.id,
          'commenter_id',      NEW.user_id,
          'parent_comment_id', NEW.parent_comment_id
        )
      );
    END IF;
  ELSE
    -- Top-level comment: notify post author
    IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
      VALUES (
        v_post_author_id,
        'comment',
        'post_comment',
        NEW.post_id,
        COALESCE(v_commenter_name, 'Neko') || ' je komentarisao vaš post',
        LEFT(NEW.text, 100),
        jsonb_build_object(
          'post_id',      NEW.post_id,
          'comment_id',   NEW.id,
          'commenter_id', NEW.user_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_post_comment ON post_comments;
CREATE TRIGGER trigger_notify_post_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_post_comment();


-- ============================================================
-- 3. COMMENT REACTION → notify comment author
-- ============================================================
CREATE OR REPLACE FUNCTION notify_comment_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_comment_author_id uuid;
  v_comment_text      text;
  v_comment_post_id   uuid;
  v_reactor_name      text;
BEGIN
  SELECT user_id, text, post_id
  INTO v_comment_author_id, v_comment_text, v_comment_post_id
  FROM post_comments WHERE id = NEW.comment_id;

  IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (
    v_comment_author_id,
    'reaction',
    'comment_reaction',
    v_comment_post_id,
    COALESCE(v_reactor_name, 'Neko') || ' je reagovao na vaš komentar',
    COALESCE(LEFT(v_comment_text, 100), 'Vaš komentar'),
    jsonb_build_object(
      'post_id',    v_comment_post_id,
      'comment_id', NEW.comment_id,
      'reactor_id', NEW.user_id,
      'emoji',      NEW.emoji
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_comment_reaction ON comment_reactions;
CREATE TRIGGER trigger_notify_comment_reaction
  AFTER INSERT ON comment_reactions
  FOR EACH ROW EXECUTE FUNCTION notify_comment_reaction();


-- ============================================================
-- 4. DIRECT MESSAGE → notify receiver
-- ============================================================
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name text;
BEGIN
  -- Skip system messages and soft-deleted
  IF NEW.is_system OR NEW.is_deleted OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if sender == receiver
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    NEW.receiver_id,
    'message',
    'message',
    COALESCE(v_sender_name, 'Neko') || ' vam je poslao poruku',
    'Imate novu poruku',
    jsonb_build_object(
      'sender_id',  NEW.sender_id,
      'message_id', NEW.id,
      'thread_id',  NEW.thread_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION create_message_notification();


-- ============================================================
-- 5. SAVED POST → notify post author
-- ============================================================
CREATE OR REPLACE FUNCTION notify_post_saved()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_text      text;
  v_saver_name     text;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text
  FROM posts WHERE id = NEW.post_id;

  -- Skip if saving own post
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Skip duplicate save notification for same user+post within 24h
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id     = v_post_author_id
      AND action_type = 'post_saved'
      AND post_id     = NEW.post_id
      AND (meta->>'saver_id')::uuid = NEW.user_id
      AND created_at  > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_saver_name FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (
    v_post_author_id,
    'save',
    'post_saved',
    NEW.post_id,
    COALESCE(v_saver_name, 'Neko') || ' je sačuvao vaš post',
    COALESCE(LEFT(v_post_text, 100), 'Vaš post'),
    jsonb_build_object(
      'post_id',  NEW.post_id,
      'saver_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='saved_posts') THEN
    DROP TRIGGER IF EXISTS trigger_notify_post_saved ON saved_posts;
    CREATE TRIGGER trigger_notify_post_saved
      AFTER INSERT ON saved_posts
      FOR EACH ROW EXECUTE FUNCTION notify_post_saved();
  END IF;
END $$;
