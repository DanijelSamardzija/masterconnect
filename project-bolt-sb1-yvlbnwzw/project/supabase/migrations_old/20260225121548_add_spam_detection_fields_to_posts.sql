/*
  # Add Spam Detection Fields to Posts

  1. New Columns
    - `spam_score` (integer, 0-100) - Calculated spam score for anti-spam system
    - `status` (text) - Post status: 'published', 'needs_review', 'shadow_hidden'
    - `rank_penalty` (numeric) - Ranking penalty multiplier (0.0 to 1.0)
    - `duplicate_hash` (text) - Hash for duplicate content detection
    - `link_count` (integer) - Number of links detected in post text
    - `phone_count` (integer) - Number of phone numbers detected in post text
    - `hashtag_count` (integer) - Number of hashtags in post text
    - `caps_ratio` (numeric) - Ratio of uppercase letters (0.0 to 1.0)

  2. Changes
    - Add index on `status` for efficient feed filtering
    - Add index on `duplicate_hash` for duplicate detection
    - Set default status to 'published' for existing posts

  3. Notes
    - `shadow_hidden` posts are only visible to owner and moderators
    - `needs_review` posts may be shown with reduced visibility
    - `rank_penalty` affects post ordering in feed (lower = less visible)
*/

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS spam_score integer DEFAULT 0 CHECK (spam_score >= 0 AND spam_score <= 100);

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published' CHECK (status IN ('published', 'needs_review', 'shadow_hidden'));

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS rank_penalty numeric DEFAULT 1.0 CHECK (rank_penalty >= 0 AND rank_penalty <= 1.0);

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS duplicate_hash text;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS link_count integer DEFAULT 0;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS phone_count integer DEFAULT 0;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS hashtag_count integer DEFAULT 0;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS caps_ratio numeric DEFAULT 0 CHECK (caps_ratio >= 0 AND caps_ratio <= 1.0);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

CREATE INDEX IF NOT EXISTS idx_posts_duplicate_hash ON posts(duplicate_hash) WHERE duplicate_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_spam_score ON posts(spam_score);
