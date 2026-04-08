/*
  # Fix video playback in post-media bucket

  ## Overview
  This migration ensures videos can be played properly by adding necessary storage policies
  and configurations for video streaming.

  ## Changes
  
  ### Storage Policies
  - Drop and recreate public read policy with explicit support for video streaming
  - Ensure bucket is properly configured as public
  
  ## Security Notes
  - Maintains public read access for media display
  - Videos require proper content-type headers for browser playback
*/

-- Ensure bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'post-media';

-- Drop existing public read policy if exists
DROP POLICY IF EXISTS "Public can view post media" ON storage.objects;
DROP POLICY IF EXISTS "Anon can view post media" ON storage.objects;

-- Recreate with explicit public access for all operations needed for video playback
CREATE POLICY "Public can view post media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-media');

-- Also ensure anon can access
CREATE POLICY "Anon can view post media"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'post-media');
