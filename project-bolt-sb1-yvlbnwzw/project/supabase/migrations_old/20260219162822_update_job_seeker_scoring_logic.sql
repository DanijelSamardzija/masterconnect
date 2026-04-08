/*
  # Update Job Seeker Post Scoring Logic

  ## Summary
  Updates the weighted scoring system specifically for job_seeker_post types.
  Removes media/portfolio scoring and focuses on recency and profile completeness.

  ## Scoring Logic

  ### Recency Score (0-50 points)
  - **0-1 day**: 50 points (most recent)
  - **1-3 days**: 30 points (recent)
  - **4-7 days**: 15 points (week old)
  - **7+ days**: 5 points (older)

  ### Completeness Score (0-30 points)
  - **Description > 100 chars**: +10 points
  - **Experience level filled**: +10 points
  - **Availability filled**: +10 points

  ### Total Score
  - Maximum possible: 80 points (50 recency + 30 completeness)
  - Minimum possible: 5 points
  - Posts sorted by total score DESC

  ## Changes
  - Removes media/portfolio image scoring (not supported)
  - Simplified recency tiers (4 tiers instead of 5)
  - Added completeness bonuses for profile fields
  - Optimized for job seeker profiles
*/

-- Drop the old function
DROP FUNCTION IF EXISTS calculate_post_score(uuid, timestamptz);

-- Create updated function with job seeker specific logic
CREATE OR REPLACE FUNCTION calculate_post_score(
  post_id uuid,
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
  -- Calculate age in days
  age_in_days := EXTRACT(EPOCH FROM (now() - post_created_at)) / 86400;

  -- Apply recency score based on post type
  IF post_type_param = 'job_seeker_post' THEN
    -- Job Seeker specific recency scoring
    IF age_in_days <= 1 THEN
      recency_score := 50;  -- 0-1 day: 50 points
    ELSIF age_in_days <= 3 THEN
      recency_score := 30;  -- 1-3 days: 30 points
    ELSIF age_in_days <= 7 THEN
      recency_score := 15;  -- 4-7 days: 15 points
    ELSE
      recency_score := 5;   -- 7+ days: 5 points
    END IF;

    -- Completeness bonuses for job seeker posts
    -- Description > 100 chars: +10
    IF LENGTH(COALESCE(post_text, '')) > 100 THEN
      completeness_score := completeness_score + 10;
    END IF;

    -- Experience level filled: +10
    IF experience_level_param IS NOT NULL AND experience_level_param != '' THEN
      completeness_score := completeness_score + 10;
    END IF;

    -- Availability filled: +10
    IF availability_param IS NOT NULL AND availability_param != '' THEN
      completeness_score := completeness_score + 10;
    END IF;

    -- Calculate final score for job seeker posts
    final_score := recency_score + completeness_score;

  ELSE
    -- Service request posts: use existing logic
    DECLARE
      base_score numeric := 100;
      age_penalty numeric := 0;
      activity_boost numeric := 0;
      low_engagement_boost numeric := 0;
      recent_activity_count integer := 0;
      thread_message_count integer := 0;
    BEGIN
      -- Apply age-based penalty (gradual decay)
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

      -- Check for recent activity
      SELECT COUNT(*) INTO recent_activity_count
      FROM (
        SELECT created_at FROM post_reactions 
        WHERE post_id = calculate_post_score.post_id 
          AND created_at > now() - interval '3 days'
        UNION ALL
        SELECT created_at FROM post_comments 
        WHERE post_id = calculate_post_score.post_id 
          AND created_at > now() - interval '3 days'
      ) recent_activity;

      IF recent_activity_count > 0 THEN
        activity_boost := 5;
      END IF;

      -- Check thread message count
      SELECT COUNT(*) INTO thread_message_count
      FROM threads t
      INNER JOIN messages m ON m.thread_id = t.id
      WHERE t.post_id = calculate_post_score.post_id
        AND m.is_system = false;

      IF thread_message_count <= 2 THEN
        low_engagement_boost := 3;
      END IF;

      final_score := base_score - age_penalty + activity_boost + low_engagement_boost;
      final_score := GREATEST(5, LEAST(110, final_score));
    END;
  END IF;

  -- Ensure score stays within reasonable bounds
  final_score := GREATEST(5, final_score);

  RETURN final_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the get_posts_with_score function to pass new parameters
CREATE OR REPLACE FUNCTION get_posts_with_score(post_types text[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  text text,
  post_type text,
  job_title text,
  profession text,
  category text,
  city text,
  experience_level text,
  location text,
  availability text,
  price_type text,
  price_value numeric,
  currency text,
  created_at timestamptz,
  user_data jsonb,
  score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.text,
    p.post_type,
    p.job_title,
    p.profession,
    p.category,
    p.city,
    p.experience_level,
    p.location,
    p.availability,
    p.price_type,
    p.price_value,
    p.currency,
    p.created_at,
    jsonb_build_object(
      'name', prof.name,
      'email', prof.email,
      'account_type', prof.account_type,
      'avatar_url', prof.avatar_url
    ) as user_data,
    calculate_post_score(
      p.id, 
      p.created_at, 
      p.post_type,
      p.text,
      p.experience_level,
      p.availability
    ) as score
  FROM posts p
  INNER JOIN profiles prof ON prof.id = p.user_id
  WHERE p.post_type = ANY(post_types)
    AND p.is_active = true
  ORDER BY score DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION get_posts_with_score(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_posts_with_score(text[]) TO anon;