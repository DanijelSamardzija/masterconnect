/*
  # Create RPC Function to Get Posts with Weighted Score

  ## Summary
  Creates a PostgreSQL RPC function that returns posts sorted by weighted score.
  This function fetches posts and their associated user data, calculates a score for each,
  and returns them sorted by score (highest first).

  ## Function Details
  - Function name: `get_posts_with_score`
  - Parameters: `post_types` (text array) - filter by post types
  - Returns: JSON array of posts with user data, sorted by score
  - Security: Uses SECURITY DEFINER to ensure proper access

  ## Return Fields
  - All post fields (id, user_id, text, post_type, etc.)
  - user_data: Associated profile data
  - Sorted by calculated score (descending)
*/

-- Create function to get posts with weighted scoring
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
    calculate_post_score(p.id, p.created_at) as score
  FROM posts p
  INNER JOIN profiles prof ON prof.id = p.user_id
  WHERE p.post_type = ANY(post_types)
    AND p.is_active = true
  ORDER BY score DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_posts_with_score(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_posts_with_score(text[]) TO anon;
