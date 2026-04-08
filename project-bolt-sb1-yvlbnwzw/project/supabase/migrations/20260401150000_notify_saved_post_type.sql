-- Update notify_post_saved to include post_type in meta
-- so the dashboard can route to /services/{id} or /jobs instead of /feed
CREATE OR REPLACE FUNCTION notify_post_saved()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_text      text;
  v_post_type      text;
  v_saver_name     text;
  v_title          text;
BEGIN
  SELECT user_id, text, post_type
  INTO v_post_author_id, v_post_text, v_post_type
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

  -- Context-aware title
  IF v_post_type = 'service_listing' THEN
    v_title := COALESCE(v_saver_name, 'Neko') || ' je sačuvao vašu uslugu';
  ELSIF v_post_type IN ('hiring_post', 'service_request', 'job_seeker_post') THEN
    v_title := COALESCE(v_saver_name, 'Neko') || ' je sačuvao vaš oglas';
  ELSE
    v_title := COALESCE(v_saver_name, 'Neko') || ' je sačuvao vaš post';
  END IF;

  INSERT INTO notifications (user_id, type, action_type, post_id, title, body, meta)
  VALUES (
    v_post_author_id,
    'save',
    'post_saved',
    NEW.post_id,
    v_title,
    COALESCE(LEFT(v_post_text, 100), 'Vaš sadržaj'),
    jsonb_build_object(
      'post_id',   NEW.post_id,
      'post_type', COALESCE(v_post_type, 'social_post'),
      'saver_id',  NEW.user_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
