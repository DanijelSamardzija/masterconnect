-- Add actor_name to meta in all notification triggers for frontend i18n

CREATE OR REPLACE FUNCTION notify_post_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_text      text;
  v_reactor_name   text;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text FROM posts WHERE id = NEW.post_id;
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM notifications WHERE user_id = v_post_author_id AND action_type = 'post_reaction'
    AND post_id = NEW.post_id AND (meta->>'reactor_id')::uuid = NEW.user_id
    AND created_at > now() - interval '1 hour'
  ) THEN RETURN NEW; END IF;
  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (v_post_author_id, 'reaction', 'post_reaction', NEW.post_id,
    COALESCE(v_reactor_name, 'Neko') || ' je reagovao na vaš post',
    COALESCE(LEFT(v_post_text, 100), 'Vaš post'),
    jsonb_build_object('post_id', NEW.post_id, 'reactor_id', NEW.user_id, 'emoji', NEW.emoji, 'actor_name', COALESCE(v_reactor_name, 'Neko'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id   uuid;
  v_post_text        text;
  v_commenter_name   text;
  v_parent_author_id uuid;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text FROM posts WHERE id = NEW.post_id;
  SELECT name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author_id FROM post_comments WHERE id = NEW.parent_comment_id;
    IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
      VALUES (v_parent_author_id, 'reply', 'comment_reply', NEW.post_id,
        COALESCE(v_commenter_name, 'Neko') || ' je odgovorio na vaš komentar',
        LEFT(NEW.text, 100),
        jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'commenter_id', NEW.user_id, 'parent_comment_id', NEW.parent_comment_id, 'actor_name', COALESCE(v_commenter_name, 'Neko'))
      );
    END IF;
  ELSE
    IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
      VALUES (v_post_author_id, 'comment', 'post_comment', NEW.post_id,
        COALESCE(v_commenter_name, 'Neko') || ' je komentarisao vaš post',
        LEFT(NEW.text, 100),
        jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'commenter_id', NEW.user_id, 'actor_name', COALESCE(v_commenter_name, 'Neko'))
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_comment_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_comment_author_id uuid;
  v_comment_text      text;
  v_comment_post_id   uuid;
  v_reactor_name      text;
BEGIN
  SELECT user_id, text, post_id INTO v_comment_author_id, v_comment_text, v_comment_post_id
  FROM post_comments WHERE id = NEW.comment_id;
  IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (v_comment_author_id, 'reaction', 'comment_reaction', v_comment_post_id,
    COALESCE(v_reactor_name, 'Neko') || ' je reagovao na vaš komentar',
    COALESCE(LEFT(v_comment_text, 100), 'Vaš komentar'),
    jsonb_build_object('post_id', v_comment_post_id, 'comment_id', NEW.comment_id, 'reactor_id', NEW.user_id, 'emoji', NEW.emoji, 'actor_name', COALESCE(v_reactor_name, 'Neko'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name text;
BEGIN
  IF NEW.is_system OR NEW.is_deleted OR NEW.receiver_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_id = NEW.receiver_id THEN RETURN NEW; END IF;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (NEW.receiver_id, 'message', 'message',
    COALESCE(v_sender_name, 'Neko') || ' vam je poslao poruku',
    'Imate novu poruku',
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id, 'thread_id', NEW.thread_id, 'actor_name', COALESCE(v_sender_name, 'Neko'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_post_saved()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_text      text;
  v_saver_name     text;
BEGIN
  SELECT user_id, text INTO v_post_author_id, v_post_text FROM posts WHERE id = NEW.post_id;
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM notifications WHERE user_id = v_post_author_id AND action_type = 'post_saved'
    AND post_id = NEW.post_id AND (meta->>'saver_id')::uuid = NEW.user_id
    AND created_at > now() - interval '24 hours'
  ) THEN RETURN NEW; END IF;
  SELECT name INTO v_saver_name FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (v_post_author_id, 'save', 'post_saved', NEW.post_id,
    COALESCE(v_saver_name, 'Neko') || ' je sačuvao vaš post',
    COALESCE(LEFT(v_post_text, 100), 'Vaš post'),
    jsonb_build_object('post_id', NEW.post_id, 'saver_id', NEW.user_id, 'actor_name', COALESCE(v_saver_name, 'Neko'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
DECLARE
  v_follower_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM notifications WHERE user_id = NEW.following_id AND action_type = 'new_follower'
    AND (meta->>'follower_id')::uuid = NEW.follower_id
    AND created_at > now() - interval '24 hours'
  ) THEN RETURN NEW; END IF;
  SELECT name INTO v_follower_name FROM profiles WHERE id = NEW.follower_id;
  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (NEW.following_id, 'follow', 'new_follower',
    COALESCE(v_follower_name, 'Neko') || ' vas je zapratio',
    'Imate novog pratioca',
    jsonb_build_object('follower_id', NEW.follower_id, 'actor_name', COALESCE(v_follower_name, 'Neko'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
