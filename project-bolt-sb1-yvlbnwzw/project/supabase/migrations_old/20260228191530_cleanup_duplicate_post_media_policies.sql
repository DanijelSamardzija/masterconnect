/*
  # Cleanup duplicate storage policies for post-media

  ## Overview
  Removes duplicate SELECT policies on storage.objects for post-media bucket.
  Multiple policies with same permissions can cause conflicts.

  ## Changes
  - Drop duplicate "Anyone can view post media" policy
  - Keep "Public can view post media" and "Anon can view post media" policies
  
  ## Security Notes
  - Maintains public read access through remaining policies
  - No change to actual permissions, just cleanup
*/

-- Drop duplicate policy
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
