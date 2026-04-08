/*
  # Add Post Pinning Feature

  1. Changes to `posts` table
    - Add `is_pinned` (boolean, default false) - indicates if post is pinned
    - Add `pinned_at` (timestamptz, nullable) - timestamp when post was pinned
  
  2. Notes
    - Only one post can be pinned per user (enforced at application level)
    - Pinned posts will appear at the top of user's posts list
    - Only post owner can pin/unpin their posts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE posts ADD COLUMN pinned_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS posts_user_pinned_idx ON posts(user_id, is_pinned, pinned_at DESC);
