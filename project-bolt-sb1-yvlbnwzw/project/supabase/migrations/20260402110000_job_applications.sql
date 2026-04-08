/*
  # Job Applications Table
  Stores applicant data when a user applies to a hiring_post.
*/

CREATE TABLE IF NOT EXISTS job_applications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id                 uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  applicant_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name               text NOT NULL,
  phone                   text,
  email                   text,
  city                    text,
  bio                     text,
  skills                  text,
  experience              text,
  expected_salary_type    text,
  expected_salary_value   numeric,
  expected_salary_currency text DEFAULT 'RSD',
  profile_image_url       text,
  cv_url                  text,
  cv_file_name            text,
  video_url               text,
  status                  text NOT NULL DEFAULT 'pending',
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, applicant_id)
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can insert own applications" ON job_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "Applicants can view own applications" ON job_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

CREATE POLICY "Post owners can view received applications" ON job_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = job_applications.post_id
        AND posts.user_id = auth.uid()
    )
  );

-- Notify post owner when a new application arrives
CREATE OR REPLACE FUNCTION notify_new_job_application()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner_id uuid;
  v_applicant_name text;
  v_post_title text;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_applicant_name FROM profiles WHERE id = NEW.applicant_id;
  SELECT COALESCE(job_title, text, 'oglas') INTO v_post_title FROM posts WHERE id = NEW.post_id;

  -- Deduplicate: one notification per applicant per post per 24h
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id     = v_post_owner_id
      AND action_type = 'new_application'
      AND (meta->>'applicant_id')::uuid = NEW.applicant_id
      AND (meta->>'post_id')::uuid = NEW.post_id
      AND created_at  > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, action_type, title, body, meta)
  VALUES (
    v_post_owner_id,
    'application',
    'new_application',
    COALESCE(v_applicant_name, 'Neko') || ' se prijavio na vaš oglas',
    COALESCE(v_post_title, 'Nova prijava'),
    jsonb_build_object(
      'applicant_id', NEW.applicant_id,
      'post_id',      NEW.post_id,
      'application_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_job_application ON job_applications;
CREATE TRIGGER trigger_notify_new_job_application
  AFTER INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_new_job_application();
