-- ============================================================
-- saved_posts table
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved posts" ON saved_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts" ON saved_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts" ON saved_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);

-- Re-create saved_posts trigger now that table exists
DROP TRIGGER IF EXISTS trigger_notify_post_saved ON saved_posts;
CREATE TRIGGER trigger_notify_post_saved
  AFTER INSERT ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION notify_post_saved();

-- ============================================================
-- get_feed_with_engagement_score function
-- ============================================================
CREATE OR REPLACE FUNCTION get_feed_with_engagement_score(
  p_user_id   uuid DEFAULT NULL,
  p_city      text DEFAULT NULL,
  p_category  text DEFAULT NULL,
  p_limit     int  DEFAULT 15,
  p_offset    int  DEFAULT 0,
  p_as_of     timestamptz DEFAULT now(),
  p_post_type text DEFAULT 'social_post'
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  text              text,
  created_at        timestamptz,
  post_type         text,
  status            text,
  category          text,
  city              text,
  is_pinned         boolean,
  pinned_at         timestamptz,
  spam_score        numeric,
  rank_penalty      numeric,
  link_count        int,
  phone_count       int,
  hashtag_count     int,
  job_title         text,
  price_type        text,
  price_value       numeric,
  currency          text,
  profession        text,
  experience_level  text,
  availability      text,
  engagement_score  numeric,
  reactions_count   bigint,
  comments_count    bigint,
  user_has_reacted  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.user_id,
    p.text,
    p.created_at,
    p.post_type,
    p.status,
    p.category,
    p.city,
    p.is_pinned,
    p.pinned_at,
    p.spam_score,
    p.rank_penalty,
    p.link_count,
    p.phone_count,
    p.hashtag_count,
    p.job_title,
    p.price_type,
    p.price_value,
    p.currency,
    p.profession,
    p.experience_level,
    p.availability,
    -- engagement score: recency + reactions + comments, minus penalties
    COALESCE(
      (1.0 / (1.0 + EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 3600)) * 100
      + COALESCE(r.reactions_count, 0) * 2
      + COALESCE(c.comments_count, 0) * 3
      - COALESCE(p.spam_score, 0) * 10
      - COALESCE(p.rank_penalty, 0) * 5
    , 0) AS engagement_score,
    COALESCE(r.reactions_count, 0) AS reactions_count,
    COALESCE(c.comments_count, 0) AS comments_count,
    CASE WHEN p_user_id IS NOT NULL THEN
      EXISTS (
        SELECT 1 FROM post_reactions pr
        WHERE pr.post_id = p.id AND pr.user_id = p_user_id
      )
    ELSE false END AS user_has_reacted
  FROM posts p
  LEFT JOIN (
    SELECT post_id, COUNT(*) AS reactions_count
    FROM post_reactions
    GROUP BY post_id
  ) r ON r.post_id = p.id
  LEFT JOIN (
    SELECT post_id, COUNT(*) AS comments_count
    FROM post_comments
    WHERE TRUE
    GROUP BY post_id
  ) c ON c.post_id = p.id
  WHERE
    p.post_type = p_post_type
    AND (p.status IN ('active', 'published') OR p.status IS NULL)
    AND (p_city IS NULL OR p.city ILIKE p_city)
    AND (p_category IS NULL OR p.category ILIKE p_category)
  ORDER BY
    p.is_pinned DESC NULLS LAST,
    engagement_score DESC,
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
