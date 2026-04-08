/*
  # Add Image Metadata to Posts

  1. Changes
    - Add image metadata columns to post_media table
    - Add width and height to track original dimensions
    - Add thumbnail_url for optimized display versions

  2. Purpose
    - Enable better image display optimization
    - Track image dimensions for proper aspect ratios
    - Support thumbnail generation for performance
*/

ALTER TABLE post_media
ADD COLUMN IF NOT EXISTS width integer,
ADD COLUMN IF NOT EXISTS height integer,
ADD COLUMN IF NOT EXISTS thumbnail_url text;

COMMENT ON COLUMN post_media.width IS 'Original image width in pixels';
COMMENT ON COLUMN post_media.height IS 'Original image height in pixels';
COMMENT ON COLUMN post_media.thumbnail_url IS 'URL to optimized thumbnail version of image';
