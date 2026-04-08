/*
  # Add Weighted Post Scoring Function

  ## Summary
  Creates a PostgreSQL function to calculate a weighted score for service request posts.
  The score prioritizes fresh posts while gradually reducing priority for older ones.

  ## Scoring Logic
  - **Fresh posts (0-2 days)**: Score 100-90 (highest priority)
  - **Recent posts (3-7 days)**: Score 89-70
  - **Week-old posts (8-14 days)**: Score 69-50
  - **Older posts (15-30 days)**: Score 49-20
  - **Very old posts (30+ days)**: Score 19-5 (lowest priority)
  - **Activity boost**: +5 points for posts with recent reactions/comments
  - **Low engagement boost**: +3 points for posts with 0-2 thread messages (fewer offers)

  ## Function Details
  - Function name: `calculate_post_score`
  - Returns: numeric score for sorting
  - Used in: Service request listing queries
*/

-- Create function to calculate weighted post score
CREATE OR REPLACE FUNCTION calculate_post_score(
  post_id uuid,
  post_created_at timestamptz
) RETURNS numeric AS $$
DECLARE
  base_score numeric := 100;
  age_in_days numeric;
  age_penalty numeric := 0;
  activity_boost numeric := 0;
  low_engagement_boost numeric := 0;
  recent_activity_count integer := 0;
  thread_message_count integer := 0;
  final_score numeric;
BEGIN
  -- Calculate age in days
  age_in_days := EXTRACT(EPOCH FROM (now() - post_created_at)) / 86400;

  -- Apply age-based penalty (gradual decay)
  IF age_in_days <= 2 THEN
    -- Fresh posts: minimal penalty (0-10 points)
    age_penalty := age_in_days * 5;
  ELSIF age_in_days <= 7 THEN
    -- Recent posts: moderate penalty (10-30 points)
    age_penalty := 10 + ((age_in_days - 2) * 4);
  ELSIF age_in_days <= 14 THEN
    -- Week-old posts: higher penalty (30-50 points)
    age_penalty := 30 + ((age_in_days - 7) * 2.86);
  ELSIF age_in_days <= 30 THEN
    -- Older posts: significant penalty (50-80 points)
    age_penalty := 50 + ((age_in_days - 14) * 1.88);
  ELSE
    -- Very old posts: maximum penalty (80-95 points)
    age_penalty := 80 + LEAST((age_in_days - 30) * 0.5, 15);
  END IF;

  -- Check for recent activity (reactions/comments in last 3 days)
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

  -- Boost posts with recent activity
  IF recent_activity_count > 0 THEN
    activity_boost := 5;
  END IF;

  -- Check thread message count (fewer messages = fewer offers)
  SELECT COUNT(*) INTO thread_message_count
  FROM threads t
  INNER JOIN messages m ON m.thread_id = t.id
  WHERE t.post_id = calculate_post_score.post_id
    AND m.is_system = false;

  -- Boost posts with low engagement (0-2 messages = likely no or few offers)
  IF thread_message_count <= 2 THEN
    low_engagement_boost := 3;
  END IF;

  -- Calculate final score
  final_score := base_score - age_penalty + activity_boost + low_engagement_boost;

  -- Ensure score stays within reasonable bounds
  final_score := GREATEST(5, LEAST(110, final_score));

  RETURN final_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add index to improve performance of score calculations
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_created 
  ON post_reactions(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_created 
  ON post_comments(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_threads_post_id 
  ON threads(post_id) WHERE post_id IS NOT NULL;
