/*
  # Add shadow_limited Status

  1. Changes
    - Add 'shadow_limited' to status enum
    - This is a middle ground between published and shadow_hidden
    - Allows users with 6-8 links to have reduced visibility but not hidden

  2. Logic
    - shadow_limited posts are visible to everyone but ranked lower
    - shadow_hidden posts are only visible to author
    - This provides better UX by giving users a chance to fix issues
*/

ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts 
ADD CONSTRAINT posts_status_check 
CHECK (status IN ('published', 'needs_review', 'shadow_limited', 'shadow_hidden'));
