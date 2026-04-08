/*
  # Filter Shadow Hidden Posts in Scoring Function

  ## Summary
  Updates the `get_posts_with_score` function to exclude shadow_hidden posts from public views.

  ## Changes
  - Adds `status = 'published'` filter to the WHERE clause
  - Only published posts will be returned by the scoring function
  - Shadow_hidden posts will remain in the database but won't appear in jobs/marketplace pages
  - Authors can still view their shadow_hidden posts on their own profile

  ## Security
  - Public users only see published posts
  - Authors see all their posts (handled in profile queries, not this function)
*/

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
    AND p.status = 'published'
  ORDER BY score DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
