/*
  # Create Posts and Post Media Tables

  ## Overview
  This migration creates tables for user profile posts with support for text content and media attachments (images/videos).

  ## New Tables
  
  ### `posts`
  - `id` (uuid, primary key) - Unique identifier for each post
  - `user_id` (uuid, foreign key) - References profiles.id, the post owner
  - `text` (text, nullable) - Optional text content of the post
  - `created_at` (timestamptz) - When the post was created
  - `updated_at` (timestamptz) - When the post was last updated

  ### `post_media`
  - `id` (uuid, primary key) - Unique identifier for each media item
  - `post_id` (uuid, foreign key) - References posts.id
  - `type` (text) - Media type: "image" or "video"
  - `url` (text) - URL to the media file
  - `order` (integer) - Display order for multiple media items
  - `created_at` (timestamptz) - When the media was added

  ## Security
  - RLS enabled on all tables
  - Users can create their own posts
  - Users can read all posts (public feed)
  - Users can update/delete only their own posts
  - Media follows the same access rules as posts

  ## Notes
  - Posts are sorted by created_at DESC (newest first)
  - A post can have text + multiple images OR text + one video
  - Validation for media rules is enforced at application level
*/

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create post_media table
CREATE TABLE IF NOT EXISTS post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  url text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_order ON post_media(post_id, "order");

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

-- Posts policies
CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Post media policies
CREATE POLICY "Anyone can view post media"
  ON post_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
    )
  );

CREATE POLICY "Users can add media to their own posts"
  ON post_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update media on their own posts"
  ON post_media FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete media from their own posts"
  ON post_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
