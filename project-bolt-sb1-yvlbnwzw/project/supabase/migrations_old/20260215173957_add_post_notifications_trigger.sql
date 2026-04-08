/*
  # Add Post-Based Notifications

  1. Schema Changes
    - Add `post_id` (uuid, foreign key, nullable) to notifications table
    - Add `action_type` (text, nullable) to differentiate between 'reaction', 'comment', etc.

  2. Triggers
    - Create function to notify post author when someone reacts to their post
    - Create function to notify post author when someone comments on their post
    - Create function to notify comment author when someone replies to their comment
    - Create triggers for post_reactions and post_comments tables

  3. Security
    - No RLS changes needed (existing policies apply)

  4. Notes
    - Notifications are only created if the action is not from the post/comment author themselves
    - Post information is stored in both post_id field and meta for flexibility
    - Action type helps UI display appropriate icon and message
*/

-- Add new columns to notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'post_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN post_id uuid REFERENCES posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_type text;
  END IF;
END $$;

-- Create index on post_id for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON notifications(post_id);

-- Function to notify post author about reactions
CREATE OR REPLACE FUNCTION notify_post_reaction()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id uuid;
  post_text text;
  reactor_name text;
BEGIN
  -- Get post author and text
  SELECT user_id, text INTO post_author_id, post_text
  FROM posts
  WHERE id = NEW.post_id;

  -- Get reactor name
  SELECT name INTO reactor_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Only create notification if reactor is not the post author
  IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
    INSERT INTO notifications (
      user_id,
      type,
      action_type,
      post_id,
      title,
      body,
      meta
    ) VALUES (
      post_author_id,
      'reaction',
      'post_reaction',
      NEW.post_id,
      reactor_name || ' je reagovao na vaš post',
      COALESCE(LEFT(post_text, 100), 'Vaš post'),
      jsonb_build_object(
        'post_id', NEW.post_id,
        'reactor_id', NEW.user_id,
        'emoji', NEW.emoji
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify post author about comments
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id uuid;
  post_text text;
  commenter_name text;
  parent_comment_author_id uuid;
BEGIN
  -- Get post author and text
  SELECT user_id, text INTO post_author_id, post_text
  FROM posts
  WHERE id = NEW.post_id;

  -- Get commenter name
  SELECT name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- If this is a reply to another comment
  IF NEW.parent_comment_id IS NOT NULL THEN
    -- Get parent comment author
    SELECT user_id INTO parent_comment_author_id
    FROM post_comments
    WHERE id = NEW.parent_comment_id;

    -- Notify parent comment author about the reply
    IF parent_comment_author_id IS NOT NULL AND parent_comment_author_id != NEW.user_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        action_type,
        post_id,
        title,
        body,
        meta
      ) VALUES (
        parent_comment_author_id,
        'reply',
        'comment_reply',
        NEW.post_id,
        commenter_name || ' je odgovorio na vaš komentar',
        LEFT(NEW.text, 100),
        jsonb_build_object(
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'commenter_id', NEW.user_id,
          'parent_comment_id', NEW.parent_comment_id
        )
      );
    END IF;
  ELSE
    -- Notify post author about the comment
    IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        action_type,
        post_id,
        title,
        body,
        meta
      ) VALUES (
        post_author_id,
        'comment',
        'post_comment',
        NEW.post_id,
        commenter_name || ' je komentarisao vaš post',
        LEFT(NEW.text, 100),
        jsonb_build_object(
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'commenter_id', NEW.user_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify post author about comment reactions
CREATE OR REPLACE FUNCTION notify_comment_reaction()
RETURNS TRIGGER AS $$
DECLARE
  comment_author_id uuid;
  comment_text text;
  comment_post_id uuid;
  reactor_name text;
BEGIN
  -- Get comment author, text, and post_id
  SELECT user_id, text, post_id INTO comment_author_id, comment_text, comment_post_id
  FROM post_comments
  WHERE id = NEW.comment_id;

  -- Get reactor name
  SELECT name INTO reactor_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Only create notification if reactor is not the comment author
  IF comment_author_id IS NOT NULL AND comment_author_id != NEW.user_id THEN
    INSERT INTO notifications (
      user_id,
      type,
      action_type,
      post_id,
      title,
      body,
      meta
    ) VALUES (
      comment_author_id,
      'reaction',
      'comment_reaction',
      comment_post_id,
      reactor_name || ' je reagovao na vaš komentar',
      COALESCE(LEFT(comment_text, 100), 'Vaš komentar'),
      jsonb_build_object(
        'post_id', comment_post_id,
        'comment_id', NEW.comment_id,
        'reactor_id', NEW.user_id,
        'emoji', NEW.emoji
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_post_reaction ON post_reactions;
DROP TRIGGER IF EXISTS trigger_notify_post_comment ON post_comments;
DROP TRIGGER IF EXISTS trigger_notify_comment_reaction ON comment_reactions;

-- Create triggers
CREATE TRIGGER trigger_notify_post_reaction
  AFTER INSERT ON post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_reaction();

CREATE TRIGGER trigger_notify_post_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

CREATE TRIGGER trigger_notify_comment_reaction
  AFTER INSERT ON comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_reaction();