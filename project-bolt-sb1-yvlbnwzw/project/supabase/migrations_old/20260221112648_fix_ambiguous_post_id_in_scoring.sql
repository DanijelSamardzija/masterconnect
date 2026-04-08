/*
  # Fix Ambiguous post_id Reference in Scoring Function

  1. Changes
    - Rename function parameter from `post_id` to `post_id_param`
    - Update all references to use `post_id_param` consistently
    - This fixes the "column reference post_id is ambiguous" error
*/

DROP FUNCTION IF EXISTS calculate_post_score(uuid, timestamptz, text, text, text, text);

CREATE OR REPLACE FUNCTION calculate_post_score(
  post_id_param uuid,
  post_created_at timestamptz,
  post_type_param text,
  post_text text,
  experience_level_param text,
  availability_param text
) RETURNS numeric AS $$
DECLARE
  recency_score numeric := 0;
  completeness_score numeric := 0;
  age_in_days numeric;
  final_score numeric;
BEGIN
  age_in_days := EXTRACT(EPOCH FROM (now() - post_created_at)) / 86400;

  IF post_type_param = 'job_seeker_post' THEN
    IF age_in_days <= 1 THEN
      recency_score := 50;
    ELSIF age_in_days <= 3 THEN
      recency_score := 30;
    ELSIF age_in_days <= 7 THEN
      recency_score := 15;
    ELSE
      recency_score := 5;
    END IF;

    IF LENGTH(COALESCE(post_text, '')) > 100 THEN
      completeness_score := completeness_score + 10;
    END IF;

    IF experience_level_param IS NOT NULL AND experience_level_param != '' THEN
      completeness_score := completeness_score + 10;
    END IF;

    IF availability_param IS NOT NULL AND availability_param != '' THEN
      completeness_score := completeness_score + 10;
    END IF;

    final_score := recency_score + completeness_score;

  ELSE
    DECLARE
      base_score numeric := 100;
      age_penalty numeric := 0;
      activity_boost numeric := 0;
      low_engagement_boost numeric := 0;
      recent_activity_count integer := 0;
      thread_message_count integer := 0;
    BEGIN
      IF age_in_days <= 2 THEN
        age_penalty := age_in_days * 5;
      ELSIF age_in_days <= 7 THEN
        age_penalty := 10 + ((age_in_days - 2) * 4);
      ELSIF age_in_days <= 14 THEN
        age_penalty := 30 + ((age_in_days - 7) * 2.86);
      ELSIF age_in_days <= 30 THEN
        age_penalty := 50 + ((age_in_days - 14) * 1.88);
      ELSE
        age_penalty := 80 + LEAST((age_in_days - 30) * 0.5, 15);
      END IF;

      SELECT COUNT(*) INTO recent_activity_count
      FROM (
        SELECT created_at FROM post_reactions 
        WHERE post_id = post_id_param
          AND created_at > now() - interval '3 days'
        UNION ALL
        SELECT created_at FROM post_comments 
        WHERE post_id = post_id_param
          AND created_at > now() - interval '3 days'
      ) recent_activity;

      IF recent_activity_count > 0 THEN
        activity_boost := 5;
      END IF;

      SELECT COUNT(*) INTO thread_message_count
      FROM threads t
      INNER JOIN messages m ON m.thread_id = t.id
      WHERE t.post_id = post_id_param
        AND m.is_system = false;

      IF thread_message_count <= 2 THEN
        low_engagement_boost := 3;
      END IF;

      final_score := base_score - age_penalty + activity_boost + low_engagement_boost;
      final_score := GREATEST(5, LEAST(110, final_score));
    END;
  END IF;

  final_score := GREATEST(5, final_score);

  RETURN final_score;
END;
$$ LANGUAGE plpgsql STABLE;