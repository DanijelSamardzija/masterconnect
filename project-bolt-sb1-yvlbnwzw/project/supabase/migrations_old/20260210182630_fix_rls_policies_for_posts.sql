/*
  # Fix RLS Policies for Posts and Related Tables
  
  1. Changes
    - Drop and recreate RLS policies for posts table
    - Ensure authenticated users can create, read, update, and delete their own posts
    - Fix policy checks to properly use auth.uid()
    
  2. Security
    - Maintains strict RLS for data access
    - Users can only modify their own content
*/

-- Drop existing posts policies
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- Recreate policies with proper checks
CREATE POLICY "Authenticated users can view all posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix post_media policies
DROP POLICY IF EXISTS "Anyone can view post media" ON post_media;
DROP POLICY IF EXISTS "Users can add media to their own posts" ON post_media;
DROP POLICY IF EXISTS "Users can update media on their own posts" ON post_media;
DROP POLICY IF EXISTS "Users can delete media from their own posts" ON post_media;

CREATE POLICY "Authenticated users can view post media"
  ON post_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add media to own posts"
  ON post_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_media.post_id 
      AND posts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own post media"
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

CREATE POLICY "Users can delete own post media"
  ON post_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_media.post_id 
      AND posts.user_id = auth.uid()
    )
  );

-- Fix post_reactions policies
DROP POLICY IF EXISTS "Anyone can view post reactions" ON post_reactions;
DROP POLICY IF EXISTS "Users can add their own reactions" ON post_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON post_reactions;

CREATE POLICY "Authenticated users can view reactions"
  ON post_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions"
  ON post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON post_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix post_comments policies
DROP POLICY IF EXISTS "Anyone can view post comments" ON post_comments;
DROP POLICY IF EXISTS "Users can create comments on posts" ON post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;

CREATE POLICY "Authenticated users can view comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix comment_reactions policies
DROP POLICY IF EXISTS "Anyone can view comment reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Users can add their own reactions to comments" ON comment_reactions;
DROP POLICY IF EXISTS "Users can delete their own comment reactions" ON comment_reactions;

CREATE POLICY "Authenticated users can view comment reactions"
  ON comment_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add comment reactions"
  ON comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment reactions"
  ON comment_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
