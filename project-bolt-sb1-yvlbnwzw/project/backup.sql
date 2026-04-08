


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_thread_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_thread_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Comment reactions (before comments)
  DELETE FROM comment_reactions WHERE user_id = v_user_id;

  -- Post comments
  DELETE FROM post_comments WHERE user_id = v_user_id;

  -- Post reactions
  DELETE FROM post_reactions WHERE user_id = v_user_id;

  -- Posts (cascades post_media via ON DELETE CASCADE if set, else explicit)
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = v_user_id);
  DELETE FROM posts WHERE user_id = v_user_id;

  -- Message reactions
  DELETE FROM message_reactions WHERE user_id = v_user_id;

  -- Soft-delete messages sent by user (keep thread structure intact)
  UPDATE messages
  SET sender_id = NULL, is_deleted = true
  WHERE sender_id = v_user_id;

  -- Thread participants
  DELETE FROM thread_participants WHERE user_id = v_user_id;

  -- Notifications
  DELETE FROM notifications WHERE user_id = v_user_id;

  -- Blocks (both sides)
  DELETE FROM blocks WHERE blocker_user_id = v_user_id OR blocked_user_id = v_user_id;

  -- Reports (both sides)
  DELETE FROM reports WHERE reporter_user_id = v_user_id OR target_owner_user_id = v_user_id;

  -- Saved posts
  DELETE FROM saved_posts WHERE user_id = v_user_id;

  -- Followers (both sides)
  DELETE FROM followers WHERE follower_id = v_user_id OR following_id = v_user_id;

  -- Reviews: anonymize ones user wrote, delete ones user received (as pro)
  UPDATE reviews SET customer_id = NULL WHERE customer_id = v_user_id;
  DELETE FROM reviews WHERE pro_id = v_user_id;

  -- Offers
  DELETE FROM offers WHERE sender_id = v_user_id OR receiver_id = v_user_id;

  -- Jobs posted by this user
  DELETE FROM jobs WHERE customer_id = v_user_id;

  -- Pro profile
  DELETE FROM pro_profiles WHERE id = v_user_id;

  -- Main profile (last — FK root)
  DELETE FROM profiles WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete account: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed_with_engagement_score"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_city" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_as_of" timestamp with time zone DEFAULT "now"(), "p_post_type" "text" DEFAULT 'social_post'::"text", "p_hashtag" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "text" "text", "post_type" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_pinned" boolean, "pinned_at" timestamp with time zone, "status" "text", "spam_score" integer, "rank_penalty" numeric, "moderation_reasons" "text"[], "phone_count" integer, "link_count" integer, "hashtag_count" integer, "city" "text", "category" "text", "hashtags" "text"[], "reactions_count" bigint, "comments_count" bigint, "views_count" bigint, "feed_score" numeric, "user_name" "text", "user_email" "text", "user_account_type" "text", "user_avatar_url" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  blocked_user_ids uuid[];
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT array_agg(blocked_user_id)
    INTO blocked_user_ids
    FROM blocks
    WHERE blocker_user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH post_counts AS (
    SELECT
      p.id AS post_id,
      COALESCE(COUNT(DISTINCT pr.id), 0) AS reactions_count,
      COALESCE(COUNT(DISTINCT pc.id), 0) AS comments_count
    FROM posts p
    LEFT JOIN post_reactions pr ON pr.post_id = p.id
    LEFT JOIN post_comments pc ON pc.post_id = p.id
    WHERE
      (p_post_type IS NULL OR p.post_type = p_post_type)
      AND (
        (p.user_id = p_user_id) OR (p.status = 'published')
      )
      AND (p_city IS NULL OR p.city = p_city)
      AND (p_category IS NULL OR p.category = p_category)
      AND (p_hashtag IS NULL OR p_hashtag = ANY(COALESCE(p.hashtags, '{}')))
      AND (blocked_user_ids IS NULL OR NOT (p.user_id = ANY(blocked_user_ids)))
    GROUP BY p.id
  ),
  scored_posts AS (
    SELECT
      p.id,
      p.user_id,
      p.text,
      p.post_type,
      p.created_at,
      p.updated_at,
      p.is_pinned,
      p.pinned_at,
      p.status,
      p.spam_score,
      p.rank_penalty,
      p.moderation_reasons,
      p.phone_count,
      p.link_count,
      p.hashtag_count,
      p.city,
      p.category,
      COALESCE(p.hashtags, '{}') AS hashtags,
      pc.reactions_count,
      pc.comments_count,
      COALESCE(p.views_count, 0)::bigint AS views_count,
      prof.name AS user_name,
      prof.email AS user_email,
      prof.account_type AS user_account_type,
      prof.avatar_url AS user_avatar_url,
      (
        ((pc.reactions_count * 2) + (pc.comments_count * 5))::numeric
        + LEAST(30.0, COALESCE(p.views_count, 0) * 0.3)
        + CASE
            WHEN EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 60 <= 30 THEN 20
            WHEN EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 3600 <= 6 THEN 8
            ELSE 0
          END
        - LEAST(60, (EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 3600) * 0.6)
        - (COALESCE(p.spam_score, 0) * 1.0)
      ) * COALESCE(p.rank_penalty, 1.0) AS feed_score
    FROM posts p
    INNER JOIN post_counts pc ON pc.post_id = p.id
    INNER JOIN profiles prof ON p.user_id = prof.id
  )
  SELECT
    sp.id, sp.user_id, sp.text, sp.post_type, sp.created_at, sp.updated_at,
    sp.is_pinned, sp.pinned_at, sp.status, sp.spam_score, sp.rank_penalty,
    sp.moderation_reasons, sp.phone_count, sp.link_count, sp.hashtag_count,
    sp.city, sp.category, sp.hashtags,
    sp.reactions_count, sp.comments_count, sp.views_count, sp.feed_score,
    sp.user_name, sp.user_email, sp.user_account_type, sp.user_avatar_url
  FROM scored_posts sp
  ORDER BY
    sp.is_pinned DESC,
    sp.pinned_at DESC NULLS LAST,
    sp.feed_score DESC,
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_feed_with_engagement_score"("p_user_id" "uuid", "p_city" "text", "p_category" "text", "p_limit" integer, "p_offset" integer, "p_as_of" timestamp with time zone, "p_post_type" "text", "p_hashtag" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_name text;
  user_account_type text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer');

  INSERT INTO public.profiles (id, name, email, account_type, role, created_at)
  VALUES (NEW.id, user_name, NEW.email, user_account_type, user_account_type, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_views"("post_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE posts SET views_count = views_count + 1 WHERE id = post_id;
$$;


ALTER FUNCTION "public"."increment_post_views"("post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_comment_reaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_comment_reaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_follower"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_new_follower"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_job_application"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_new_job_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_post_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_reaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_post_reaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_post_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_post_saved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_thread_deleted_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE thread_participants
  SET deleted_at = NULL
  WHERE thread_id = NEW.thread_id
    AND deleted_at IS NOT NULL;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reset_thread_deleted_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = OLD.pro_id),
      review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = OLD.pro_id)
    WHERE id = OLD.pro_id;
  ELSE
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = NEW.pro_id),
      review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = NEW.pro_id)
    WHERE id = NEW.pro_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_profile_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_user_id" "uuid" NOT NULL,
    "blocked_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "city" "text",
    "bio" "text",
    "skills" "text",
    "experience" "text",
    "expected_salary_type" "text",
    "expected_salary_value" numeric,
    "expected_salary_currency" "text" DEFAULT 'RSD'::"text",
    "profile_image_url" "text",
    "cv_url" "text",
    "cv_file_name" "text",
    "video_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "city" "text" NOT NULL,
    "budget" "text",
    "preferred_date" "text",
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "completion_requested" boolean DEFAULT false,
    "completion_requested_at" timestamp with time zone,
    "completion_request_dismissed_at" timestamp with time zone,
    "completion_reminder_sent_at" timestamp with time zone,
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "payment_placeholder_message_sent" boolean DEFAULT false,
    "job_type" "text" DEFAULT 'project'::"text",
    "category_normalized" "text"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_system" boolean DEFAULT false NOT NULL,
    "delivered_at" timestamp with time zone,
    "seen_at" timestamp with time zone,
    "receiver_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "message_type" "text" DEFAULT 'text'::"text",
    "offer_id" "uuid",
    "system_message_type" "text"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'message'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "post_id" "uuid",
    "action_type" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "related_post_id" "uuid",
    "price" numeric NOT NULL,
    "currency" "text" DEFAULT 'RSD'::"text" NOT NULL,
    "estimated_start" "date",
    "duration_deadline" "text",
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "message_id" "uuid",
    "offer_type" "text" DEFAULT 'job'::"text" NOT NULL,
    "price_type" "text" DEFAULT 'fixed'::"text"
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "page" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."page_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_comment_id" "uuid"
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "width" integer,
    "height" integer,
    "thumbnail_url" "text",
    "overlay_text" "text",
    "overlay_color" "text",
    "overlay_x" numeric DEFAULT 50,
    "overlay_y" numeric DEFAULT 50,
    "overlay_width" numeric DEFAULT 80,
    "overlay_align" "text" DEFAULT 'center'::"text",
    "overlay_font_size" numeric DEFAULT 32
);


ALTER TABLE "public"."post_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reaction_type" "text" DEFAULT 'like'::"text"
);


ALTER TABLE "public"."post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "pinned_at" timestamp with time zone,
    "post_type" "text" NOT NULL,
    "profession" "text",
    "experience_level" "text",
    "location" "text",
    "availability" "text",
    "is_active" boolean DEFAULT true,
    "category_normalized" "text",
    "category" "text",
    "city" "text",
    "job_title" "text",
    "price_type" "text",
    "price_value" numeric,
    "min_price" numeric,
    "max_price" numeric,
    "currency" "text" DEFAULT 'RSD'::"text" NOT NULL,
    "spam_score" integer DEFAULT 0,
    "status" "text" DEFAULT 'published'::"text",
    "rank_penalty" numeric DEFAULT 1.0,
    "duplicate_hash" "text",
    "link_count" integer DEFAULT 0,
    "phone_count" integer DEFAULT 0,
    "hashtag_count" integer DEFAULT 0,
    "caps_ratio" numeric DEFAULT 0,
    "moderation_reasons" "text"[] DEFAULT '{}'::"text"[],
    "pinned" boolean,
    "views_count" integer DEFAULT 0,
    "hashtags" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pro_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bio" "text" DEFAULT ''::"text",
    "city" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "avatar_url" "text",
    "starting_price" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pro_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'customer'::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text",
    "recent_emojis" "jsonb" DEFAULT '[]'::"jsonb",
    "bio" "text",
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "city" "text",
    "avatar_url" "text",
    "cover_url" "text",
    "account_type" "text" NOT NULL,
    "is_admin" boolean DEFAULT false,
    "category" "text",
    "average_rating" numeric,
    "review_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "website_url" "text",
    "show_phone" boolean DEFAULT true NOT NULL,
    "show_email" boolean DEFAULT false NOT NULL,
    "last_seen" timestamp with time zone,
    "is_banned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "target_owner_user_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "pro_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "job_id" "uuid"
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'other'::"text",
    "attachment_url" "text",
    "attachment_name" "text"
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "last_read_at" timestamp with time zone
);


ALTER TABLE "public"."thread_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "thread_type" "text" DEFAULT 'direct'::"text" NOT NULL,
    "post_id" "uuid"
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_user_id_blocked_user_id_key" UNIQUE ("blocker_user_id", "blocked_user_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_post_id_applicant_id_key" UNIQUE ("post_id", "applicant_id");



ALTER TABLE ONLY "public"."job_images"
    ADD CONSTRAINT "job_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_profiles"
    ADD CONSTRAINT "pro_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_profiles"
    ADD CONSTRAINT "pro_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_user_id_target_type_target_id_key" UNIQUE ("reporter_user_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_followers_follower_id" ON "public"."followers" USING "btree" ("follower_id");



CREATE INDEX "idx_followers_following_id" ON "public"."followers" USING "btree" ("following_id");



CREATE INDEX "idx_jobs_customer_id" ON "public"."jobs" USING "btree" ("customer_id");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_thread_id" ON "public"."messages" USING "btree" ("thread_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_post_comments_post_id" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_reactions_post_id" ON "public"."post_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_hashtags" ON "public"."posts" USING "gin" ("hashtags");



CREATE INDEX "idx_posts_post_type" ON "public"."posts" USING "btree" ("post_type");



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_last_seen" ON "public"."profiles" USING "btree" ("last_seen");



CREATE INDEX "idx_saved_posts_post_id" ON "public"."saved_posts" USING "btree" ("post_id");



CREATE INDEX "idx_saved_posts_user_id" ON "public"."saved_posts" USING "btree" ("user_id");



CREATE INDEX "idx_thread_participants_thread_id" ON "public"."thread_participants" USING "btree" ("thread_id");



CREATE INDEX "idx_thread_participants_user_id" ON "public"."thread_participants" USING "btree" ("user_id");



CREATE INDEX "idx_threads_user1_id" ON "public"."threads" USING "btree" ("user1_id");



CREATE INDEX "idx_threads_user2_id" ON "public"."threads" USING "btree" ("user2_id");



CREATE OR REPLACE TRIGGER "message_notification_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."create_message_notification"();



CREATE OR REPLACE TRIGGER "on_message_reset_deleted" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."reset_thread_deleted_on_message"();



CREATE OR REPLACE TRIGGER "on_thread_created" AFTER INSERT ON "public"."threads" FOR EACH ROW EXECUTE FUNCTION "public"."create_thread_participants"();



CREATE OR REPLACE TRIGGER "trigger_notify_comment_reaction" AFTER INSERT ON "public"."comment_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_comment_reaction"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_follower" AFTER INSERT ON "public"."followers" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_follower"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_job_application" AFTER INSERT ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_job_application"();



CREATE OR REPLACE TRIGGER "trigger_notify_post_comment" AFTER INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_comment"();



CREATE OR REPLACE TRIGGER "trigger_notify_post_reaction" AFTER INSERT ON "public"."post_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_reaction"();



CREATE OR REPLACE TRIGGER "trigger_notify_post_saved" AFTER INSERT ON "public"."saved_posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_post_saved"();



CREATE OR REPLACE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rating_after_review" AFTER INSERT OR DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_rating"();



CREATE OR REPLACE TRIGGER "update_reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_support_messages_updated_at" BEFORE UPDATE ON "public"."support_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_images"
    ADD CONSTRAINT "job_images_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reactions"
    ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pro_profiles"
    ADD CONSTRAINT "pro_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_target_owner_user_id_fkey" FOREIGN KEY ("target_owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pro_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can read page_views" ON "public"."page_views" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can delete all posts" ON "public"."posts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can read all views" ON "public"."page_views" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all posts" ON "public"."posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "reporter_user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Announcements are publicly viewable" ON "public"."announcements" FOR SELECT USING (true);



CREATE POLICY "Anyone can view comment reactions" ON "public"."comment_reactions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view followers" ON "public"."followers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view job images" ON "public"."job_images" FOR SELECT USING (true);



CREATE POLICY "Anyone can view jobs" ON "public"."jobs" FOR SELECT USING (true);



CREATE POLICY "Anyone can view message reactions" ON "public"."message_reactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view post media" ON "public"."post_media" FOR SELECT USING (true);



CREATE POLICY "Anyone can view post reactions" ON "public"."post_reactions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Applicants can insert own applications" ON "public"."job_applications" FOR INSERT TO "authenticated" WITH CHECK (("applicant_id" = "auth"."uid"()));



CREATE POLICY "Applicants can view own applications" ON "public"."job_applications" FOR SELECT TO "authenticated" USING (("applicant_id" = "auth"."uid"()));



CREATE POLICY "Customers can create jobs" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can create reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can update their jobs" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Job owners can manage images" ON "public"."job_images" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "job_images"."job_id") AND ("jobs"."customer_id" = "auth"."uid"())))));



CREATE POLICY "Message participants can view attachments" ON "public"."message_attachments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Offer participants can view offers" ON "public"."offers" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Only admins can manage announcements" ON "public"."announcements" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Participants can view threads" ON "public"."threads" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Post owners can update application status" ON "public"."job_applications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "job_applications"."post_id") AND ("posts"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "job_applications"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Post owners can view received applications" ON "public"."job_applications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "job_applications"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Pro profiles are publicly viewable" ON "public"."pro_profiles" FOR SELECT USING (true);



CREATE POLICY "Profiles are publicly viewable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Reviews are publicly viewable" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Thread participants can view messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."threads"
  WHERE (("threads"."id" = "messages"."thread_id") AND (("threads"."user1_id" = "auth"."uid"()) OR ("threads"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can add attachments" ON "public"."message_attachments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can create comments" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create offers" ON "public"."offers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can create posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_user_id"));



CREATE POLICY "Users can create support messages" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create threads" ON "public"."threads" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can delete their comments" ON "public"."post_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete their posts" ON "public"."posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."followers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert their own pro profile" ON "public"."pro_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own views" ON "public"."page_views" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their blocks" ON "public"."blocks" TO "authenticated" USING (("auth"."uid"() = "blocker_user_id"));



CREATE POLICY "Users can manage their comment reactions" ON "public"."comment_reactions" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their post media" ON "public"."post_media" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_media"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their reactions" ON "public"."message_reactions" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their reactions" ON "public"."post_reactions" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage thread participants" ON "public"."thread_participants" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can save posts" ON "public"."saved_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can unfollow" ON "public"."followers" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can unsave posts" ON "public"."saved_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their messages" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their offers" ON "public"."offers" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can update their own pro profile" ON "public"."pro_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view followers" ON "public"."followers" FOR SELECT USING (true);



CREATE POLICY "Users can view own saved posts" ON "public"."saved_posts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their blocks" ON "public"."blocks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "blocker_user_id"));



CREATE POLICY "Users can view their notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their support messages" ON "public"."support_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their thread participants" ON "public"."thread_participants" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."threads"
  WHERE (("threads"."id" = "thread_participants"."thread_id") AND (("threads"."user1_id" = "auth"."uid"()) OR ("threads"."user2_id" = "auth"."uid"())))))));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pro_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."create_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_thread_participants"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_thread_participants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_thread_participants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feed_with_engagement_score"("p_user_id" "uuid", "p_city" "text", "p_category" "text", "p_limit" integer, "p_offset" integer, "p_as_of" timestamp with time zone, "p_post_type" "text", "p_hashtag" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed_with_engagement_score"("p_user_id" "uuid", "p_city" "text", "p_category" "text", "p_limit" integer, "p_offset" integer, "p_as_of" timestamp with time zone, "p_post_type" "text", "p_hashtag" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feed_with_engagement_score"("p_user_id" "uuid", "p_city" "text", "p_category" "text", "p_limit" integer, "p_offset" integer, "p_as_of" timestamp with time zone, "p_post_type" "text", "p_hashtag" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_post_views"("post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_views"("post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_views"("post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_comment_reaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_comment_reaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_comment_reaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_follower"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_follower"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_follower"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_job_application"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_job_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_job_application"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_post_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_post_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_post_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_post_reaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_post_reaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_post_reaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_post_saved"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_post_saved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_post_saved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_thread_deleted_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_thread_deleted_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_thread_deleted_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."followers" TO "anon";
GRANT ALL ON TABLE "public"."followers" TO "authenticated";
GRANT ALL ON TABLE "public"."followers" TO "service_role";



GRANT ALL ON TABLE "public"."job_applications" TO "anon";
GRANT ALL ON TABLE "public"."job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."job_images" TO "anon";
GRANT ALL ON TABLE "public"."job_images" TO "authenticated";
GRANT ALL ON TABLE "public"."job_images" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."page_views" TO "anon";
GRANT ALL ON TABLE "public"."page_views" TO "authenticated";
GRANT ALL ON TABLE "public"."page_views" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_media" TO "anon";
GRANT ALL ON TABLE "public"."post_media" TO "authenticated";
GRANT ALL ON TABLE "public"."post_media" TO "service_role";



GRANT ALL ON TABLE "public"."post_reactions" TO "anon";
GRANT ALL ON TABLE "public"."post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."pro_profiles" TO "anon";
GRANT ALL ON TABLE "public"."pro_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."pro_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."saved_posts" TO "anon";
GRANT ALL ON TABLE "public"."saved_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_posts" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."thread_participants" TO "anon";
GRANT ALL ON TABLE "public"."thread_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_participants" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































