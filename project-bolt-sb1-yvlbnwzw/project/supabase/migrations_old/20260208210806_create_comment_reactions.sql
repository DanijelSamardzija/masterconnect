/*
  # Create Comment Reactions Table

  1. New Tables
    - `comment_reactions`
      - `id` (uuid, primary key) - Unique identifier for the reaction
      - `comment_id` (uuid, foreign key) - References post_comments table
      - `user_id` (uuid, foreign key) - References profiles table (the user who reacted)
      - `emoji` (text) - The emoji reaction (e.g., "👍", "❤️", "😂", "🔥", "😮", "😢")
      - `created_at` (timestamptz) - When the reaction was created

  2. Constraints
    - Unique constraint on (comment_id, user_id) - One reaction per user per comment
    - Foreign key constraints to ensure data integrity

  3. Security
    - Enable RLS on `comment_reactions` table
    - Add policy for authenticated users to read all reactions
    - Add policy for users to create/update their own reactions
    - Add policy for users to delete their own reactions

  4. Indexes
    - Index on comment_id for efficient reaction lookups per comment
    - Index on user_id for efficient user reaction queries
*/

CREATE TABLE IF NOT EXISTS comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_comment_user_reaction UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment reactions"
  ON comment_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own comment reactions"
  ON comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment reactions"
  ON comment_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment reactions"
  ON comment_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
