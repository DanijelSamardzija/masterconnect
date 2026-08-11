-- Smart Guidance system: stores AI analysis results for each post.
-- Notifies users when their post is in the wrong section or missing key info.
-- Does NOT change any existing table or policy.

CREATE TABLE IF NOT EXISTS post_guidance_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analyzed_at         timestamptz NOT NULL DEFAULT now(),

  -- Language: what we detected from post content (Priority 1), then profiles.preferred_language (Priority 2)
  detected_language   text        CHECK (detected_language IN ('sr', 'en', 'de')),

  -- Intent: what the post is trying to do
  detected_intent     text        CHECK (detected_intent IN (
                        'SEEKING_JOB', 'HIRING', 'OFFERING_SERVICE',
                        'SEEKING_SERVICE', 'PORTFOLIO', 'SOCIAL'
                      )),

  -- Section state
  current_section     text,       -- post_type at time of analysis
  recommended_section text,       -- suggested post_type (NULL = current is fine)

  -- Content quality flags
  missing_fields      text[]      DEFAULT '{}',  -- e.g. {'city','contact','description'}
  has_image_only      boolean     NOT NULL DEFAULT false,  -- image present + text < 30 chars
  image_extracted_text text,      -- text extracted from image via Vision (nullable)

  -- Decision
  should_send         boolean     NOT NULL DEFAULT false,  -- computed before insert
  guidance_type       text        CHECK (guidance_type IN (
                        'wrong_section', 'missing_content', 'image_only',
                        'wrong_section_and_missing', 'no_action'
                      )),
  confidence_score    numeric(3,2) CHECK (confidence_score BETWEEN 0 AND 1),

  -- Result
  guidance_sent       boolean     NOT NULL DEFAULT false,
  notification_id     uuid        REFERENCES notifications(id) ON DELETE SET NULL,

  -- Debugging
  error               text,
  raw_ai_response     jsonb,

  -- Edit tracking: if post is significantly updated, allow re-analysis
  post_text_hash      text,       -- md5 of post text at analysis time; compare on update
  triggered_by        text        NOT NULL DEFAULT 'post_create'
                        CHECK (triggered_by IN ('post_create', 'post_update'))
);

-- Indexes for anti-spam queries and admin panel
CREATE INDEX IF NOT EXISTS idx_guidance_user_id_sent
  ON post_guidance_log (user_id, guidance_sent, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_guidance_user_type
  ON post_guidance_log (user_id, guidance_type, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_guidance_post_id
  ON post_guidance_log (post_id);

CREATE INDEX IF NOT EXISTS idx_guidance_analyzed_at
  ON post_guidance_log (analyzed_at DESC);

-- RLS
ALTER TABLE post_guidance_log ENABLE ROW LEVEL SECURITY;

-- Admins see everything
CREATE POLICY "Admin can read all guidance logs"
  ON post_guidance_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Users see their own (for future self-serve UI if needed)
CREATE POLICY "Users can read own guidance logs"
  ON post_guidance_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert/update (webhook endpoint uses service role key)
-- No INSERT/UPDATE policy for authenticated role = service role bypasses RLS anyway
-- But we add explicit deny to prevent client-side writes
CREATE POLICY "No client insert on guidance logs"
  ON post_guidance_log FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client update on guidance logs"
  ON post_guidance_log FOR UPDATE TO authenticated
  USING (false);
