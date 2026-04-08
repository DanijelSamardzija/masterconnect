/*
  # Create post-media storage bucket

  ## Overview
  This migration creates a storage bucket for post media (images/videos) with proper RLS policies.

  ## Changes
  
  ### Storage Bucket
  - Create `post-media` bucket for storing post images and videos
  - Enable public access for viewing media
  
  ### Storage Policies
  - Allow authenticated users to upload media to their own folder
  - Allow public read access to all media
  - Allow users to delete their own media files

  ## Security Notes
  - Files are organized by user_id in folders
  - Users can only delete files from their own folder
  - Public read access allows media to be displayed in posts
*/

-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own post media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policy: Allow public read access to all media
CREATE POLICY "Public can view post media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-media');

-- Storage policy: Allow users to delete their own media
CREATE POLICY "Users can delete own post media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policy: Allow users to update their own media
CREATE POLICY "Users can update own post media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
