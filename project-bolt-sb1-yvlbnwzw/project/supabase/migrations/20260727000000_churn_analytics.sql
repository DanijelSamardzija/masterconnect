-- ── Churn Analytics: table + updated delete RPCs ────────────────────────────

-- ── 1. Analytics snapshot table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deleted_account_analytics (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at            timestamptz NOT NULL DEFAULT now(),

  -- Geography (anonymous — no UUID, no name, no email)
  country               text,

  -- Acquisition
  signup_source         text,
  utm_source            text,

  -- Account snapshot
  was_premium           boolean     NOT NULL DEFAULT false,
  account_age_days      int         NOT NULL DEFAULT 0,

  -- Activity snapshot at time of deletion
  social_post_count     int         NOT NULL DEFAULT 0,   -- post_type = 'social_post'
  service_listing_count int         NOT NULL DEFAULT 0,   -- post_type = 'service_listing'
  job_post_count        int         NOT NULL DEFAULT 0,   -- hiring_post + service_request + job_seeker_post
  thread_count          int         NOT NULL DEFAULT 0,
  credit_balance        int         NOT NULL DEFAULT 0,

  -- Churn reason (optional — user may skip)
  deletion_reason       text,
  deletion_comment      text,

  -- Deletion actor
  deleted_by            text        NOT NULL DEFAULT 'user'
    CHECK (deleted_by IN ('user', 'admin', 'system'))
);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE deleted_account_analytics ENABLE ROW LEVEL SECURITY;

-- No direct INSERT from clients — done via SECURITY DEFINER functions only.
-- SELECT only for admins.
CREATE POLICY "Admins can read deleted_account_analytics"
  ON deleted_account_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 3. Updated delete_user_account() ─────────────────────────────────────────
-- Adds: p_reason + p_comment params, anonymous snapshot INSERT, additional cleanup.

DROP FUNCTION IF EXISTS delete_user_account();

CREATE OR REPLACE FUNCTION delete_user_account(
  p_reason  text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id             uuid;
  v_country             text;
  v_signup_source       text;
  v_utm_source          text;
  v_is_premium          boolean;
  v_created_at          timestamptz;
  v_social_count        int;
  v_service_count       int;
  v_job_count           int;
  v_thread_count        int;
  v_credit_balance      int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── Gather anonymous snapshot (before any deletes) ────────────────────────
  SELECT country, signup_source, utm_source, is_premium, created_at
    INTO v_country, v_signup_source, v_utm_source, v_is_premium, v_created_at
    FROM profiles WHERE id = v_user_id;

  SELECT COUNT(*) INTO v_social_count
    FROM posts WHERE user_id = v_user_id AND post_type = 'social_post';

  SELECT COUNT(*) INTO v_service_count
    FROM posts WHERE user_id = v_user_id AND post_type = 'service_listing';

  SELECT COUNT(*) INTO v_job_count
    FROM posts WHERE user_id = v_user_id
      AND post_type IN ('hiring_post', 'service_request', 'job_seeker_post');

  SELECT COUNT(*) INTO v_thread_count
    FROM thread_participants WHERE user_id = v_user_id;

  SELECT COALESCE(balance, 0) INTO v_credit_balance
    FROM credits_balance WHERE user_id = v_user_id;

  -- ── Write anonymous snapshot ───────────────────────────────────────────────
  INSERT INTO deleted_account_analytics (
    country, signup_source, utm_source,
    was_premium, account_age_days,
    social_post_count, service_listing_count, job_post_count,
    thread_count, credit_balance,
    deletion_reason, deletion_comment, deleted_by
  ) VALUES (
    v_country, v_signup_source, v_utm_source,
    COALESCE(v_is_premium, false),
    EXTRACT(DAY FROM now() - COALESCE(v_created_at, now()))::int,
    COALESCE(v_social_count, 0),
    COALESCE(v_service_count, 0),
    COALESCE(v_job_count, 0),
    COALESCE(v_thread_count, 0),
    COALESCE(v_credit_balance, 0),
    p_reason, p_comment, 'user'
  );

  -- ── Delete all user data ───────────────────────────────────────────────────
  DELETE FROM comment_reactions   WHERE user_id = v_user_id;
  DELETE FROM post_comments       WHERE user_id = v_user_id;
  DELETE FROM post_reactions      WHERE user_id = v_user_id;
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = v_user_id);
  DELETE FROM posts               WHERE user_id = v_user_id;
  DELETE FROM message_reactions   WHERE user_id = v_user_id;
  UPDATE messages SET sender_id = NULL, is_deleted = true WHERE sender_id = v_user_id;
  DELETE FROM thread_participants WHERE user_id = v_user_id;
  DELETE FROM notifications       WHERE user_id = v_user_id;
  DELETE FROM blocks              WHERE blocker_user_id = v_user_id OR blocked_user_id = v_user_id;
  DELETE FROM reports             WHERE reporter_user_id = v_user_id OR target_owner_user_id = v_user_id;
  DELETE FROM saved_posts         WHERE user_id = v_user_id;
  DELETE FROM followers           WHERE follower_id = v_user_id OR following_id = v_user_id;
  UPDATE reviews SET customer_id = NULL WHERE customer_id = v_user_id;
  DELETE FROM reviews             WHERE pro_id = v_user_id;
  DELETE FROM offers              WHERE sender_id = v_user_id OR receiver_id = v_user_id;
  DELETE FROM jobs                WHERE customer_id = v_user_id;
  DELETE FROM job_applications    WHERE applicant_id = v_user_id;
  DELETE FROM pro_profiles        WHERE id = v_user_id;
  DELETE FROM push_subscriptions  WHERE user_id = v_user_id;
  DELETE FROM profile_views       WHERE viewer_id = v_user_id OR profile_id = v_user_id;
  DELETE FROM credit_transactions WHERE user_id = v_user_id;
  DELETE FROM credits_balance     WHERE user_id = v_user_id;
  DELETE FROM profiles            WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete account: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(text, text) TO authenticated;

-- ── 4. Updated admin_delete_user_account() ───────────────────────────────────
-- Adds anonymous snapshot INSERT before the hard delete sequence.

CREATE OR REPLACE FUNCTION admin_delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country             text;
  v_signup_source       text;
  v_utm_source          text;
  v_is_premium          boolean;
  v_created_at          timestamptz;
  v_social_count        int;
  v_service_count       int;
  v_job_count           int;
  v_thread_count        int;
  v_credit_balance      int;
BEGIN
  -- ── Gather anonymous snapshot (before any deletes) ────────────────────────
  SELECT country, signup_source, utm_source, is_premium, created_at
    INTO v_country, v_signup_source, v_utm_source, v_is_premium, v_created_at
    FROM profiles WHERE id = target_user_id;

  SELECT COUNT(*) INTO v_social_count
    FROM posts WHERE user_id = target_user_id AND post_type = 'social_post';

  SELECT COUNT(*) INTO v_service_count
    FROM posts WHERE user_id = target_user_id AND post_type = 'service_listing';

  SELECT COUNT(*) INTO v_job_count
    FROM posts WHERE user_id = target_user_id
      AND post_type IN ('hiring_post', 'service_request', 'job_seeker_post');

  SELECT COUNT(*) INTO v_thread_count
    FROM thread_participants WHERE user_id = target_user_id;

  SELECT COALESCE(balance, 0) INTO v_credit_balance
    FROM credits_balance WHERE user_id = target_user_id;

  -- ── Write anonymous snapshot ───────────────────────────────────────────────
  INSERT INTO deleted_account_analytics (
    country, signup_source, utm_source,
    was_premium, account_age_days,
    social_post_count, service_listing_count, job_post_count,
    thread_count, credit_balance,
    deletion_reason, deletion_comment, deleted_by
  ) VALUES (
    v_country, v_signup_source, v_utm_source,
    COALESCE(v_is_premium, false),
    EXTRACT(DAY FROM now() - COALESCE(v_created_at, now()))::int,
    COALESCE(v_social_count, 0),
    COALESCE(v_service_count, 0),
    COALESCE(v_job_count, 0),
    COALESCE(v_thread_count, 0),
    COALESCE(v_credit_balance, 0),
    NULL, NULL, 'admin'
  );

  -- ── Delete all user data ───────────────────────────────────────────────────
  DELETE FROM comment_reactions   WHERE user_id = target_user_id;
  DELETE FROM post_comments       WHERE user_id = target_user_id;
  DELETE FROM post_reactions      WHERE user_id = target_user_id;
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = target_user_id);
  DELETE FROM posts               WHERE user_id = target_user_id;
  DELETE FROM message_reactions   WHERE user_id = target_user_id;
  DELETE FROM messages            WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  DELETE FROM thread_participants WHERE user_id = target_user_id;
  DELETE FROM notifications       WHERE user_id = target_user_id;
  DELETE FROM blocks              WHERE blocker_user_id = target_user_id OR blocked_user_id = target_user_id;
  DELETE FROM reports             WHERE reporter_user_id = target_user_id OR target_owner_user_id = target_user_id;
  DELETE FROM saved_posts         WHERE user_id = target_user_id;
  DELETE FROM followers           WHERE follower_id = target_user_id OR following_id = target_user_id;
  UPDATE reviews SET customer_id = NULL WHERE customer_id = target_user_id;
  DELETE FROM reviews             WHERE pro_id = target_user_id;
  DELETE FROM offers              WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  DELETE FROM jobs                WHERE customer_id = target_user_id;
  DELETE FROM job_applications    WHERE applicant_id = target_user_id;
  DELETE FROM pro_profiles        WHERE id = target_user_id;
  DELETE FROM push_subscriptions  WHERE user_id = target_user_id;
  DELETE FROM profile_views       WHERE viewer_id = target_user_id OR profile_id = target_user_id;
  DELETE FROM credit_transactions WHERE user_id = target_user_id;
  DELETE FROM credits_balance     WHERE user_id = target_user_id;
  DELETE FROM profiles            WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'user_id', target_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user %: %', target_user_id, SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_user_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_delete_user_account(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user_account(uuid) TO service_role;
