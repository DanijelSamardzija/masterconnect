/*
  # Add Text Overlay Support to Post Media

  1. Changes to post_media table
    - `overlay_text` (text, nullable) - Text to display over media
    - `overlay_color` (text, nullable) - Text color (e.g., 'white', 'black', '#FF5733')
    - `overlay_size` (text, nullable) - Text size: 'small', 'medium', 'large'
    - `overlay_position` (text, nullable) - Text position: 'top', 'center', 'bottom'

  2. Purpose
    - Allows users to add text overlays to images and videos
    - Similar to Instagram/TikTok style text on media
    - Enhances visual storytelling in posts

  3. Notes
    - All fields are nullable (overlay is optional)
    - Overlay size must be one of the predefined values
    - Default gradient will be applied client-side for readability
*/

-- Add overlay fields to post_media table
DO $$
BEGIN
  -- Add overlay_text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_media' AND column_name = 'overlay_text'
  ) THEN
    ALTER TABLE post_media ADD COLUMN overlay_text text;
  END IF;

  -- Add overlay_color column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_media' AND column_name = 'overlay_color'
  ) THEN
    ALTER TABLE post_media ADD COLUMN overlay_color text;
  END IF;

  -- Add overlay_size column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_media' AND column_name = 'overlay_size'
  ) THEN
    ALTER TABLE post_media ADD COLUMN overlay_size text CHECK (overlay_size IN ('small', 'medium', 'large'));
  END IF;

  -- Add overlay_position column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_media' AND column_name = 'overlay_position'
  ) THEN
    ALTER TABLE post_media ADD COLUMN overlay_position text CHECK (overlay_position IN ('top', 'center', 'bottom'));
  END IF;
END $$;