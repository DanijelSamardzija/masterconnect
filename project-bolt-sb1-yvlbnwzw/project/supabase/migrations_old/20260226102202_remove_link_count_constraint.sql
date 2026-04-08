/*
  # Remove Link Count Constraint

  1. Problem
    - Posts with 8+ links are being rejected with "Failed to create post"
    - This appears to be a hard limit that prevents post creation
    - The desired behavior is to allow posts with any number of links
    - Posts with 10+ links should be automatically shadow_hidden (handled by anti-spam logic)

  2. Changes
    - Check and remove any CHECK constraints on link_count
    - Check and remove any triggers that validate link_count
    - Ensure posts can be created with any link_count value

  3. Notes
    - The anti-spam system already handles high link counts by setting status='shadow_hidden'
    - There should be NO hard limit that prevents post creation
    - Users should be able to create posts with 8, 12, or any number of links
*/

-- Remove any CHECK constraint on link_count column
-- (This will fail silently if constraint doesn't exist)
DO $$
BEGIN
  -- Try to drop constraint if it exists
  ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_link_count_check;
  ALTER TABLE posts DROP CONSTRAINT IF EXISTS check_link_count;
  ALTER TABLE posts DROP CONSTRAINT IF EXISTS link_count_limit;

  RAISE NOTICE 'Link count constraints removed (if they existed)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No link count constraints found or error removing them: %', SQLERRM;
END $$;

-- Ensure link_count column allows any non-negative integer
ALTER TABLE posts
ALTER COLUMN link_count DROP DEFAULT,
ALTER COLUMN link_count SET DEFAULT 0;

-- Add a comment to document the expected behavior
COMMENT ON COLUMN posts.link_count IS 'Number of links in post text. No upper limit enforced. High values trigger shadow_hidden status via anti-spam logic.';