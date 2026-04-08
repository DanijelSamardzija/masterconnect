/*
  # Update Text Overlay for Flexible Positioning

  1. Changes to `post_media` table
    - Remove old fixed positioning columns
    - Add flexible positioning columns:
      - `overlay_x` (numeric) - X position as percentage (0-100)
      - `overlay_y` (numeric) - Y position as percentage (0-100)
      - `overlay_width` (numeric) - Width as percentage (10-100)
      - `overlay_align` (text) - Text alignment: 'left', 'center', 'right'
      - `overlay_font_size` (numeric) - Font size in pixels (12-80)
    - Keep overlay_text and overlay_color

  2. Notes
    - Position stored as percentages for responsiveness
    - Width determines text container width
    - Font size in pixels for precise control
*/

-- Drop old columns
ALTER TABLE post_media DROP COLUMN IF EXISTS overlay_size;
ALTER TABLE post_media DROP COLUMN IF EXISTS overlay_position;

-- Add new flexible positioning columns
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS overlay_x numeric DEFAULT 50;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS overlay_y numeric DEFAULT 50;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS overlay_width numeric DEFAULT 80;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS overlay_align text DEFAULT 'center' CHECK (overlay_align IN ('left', 'center', 'right'));
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS overlay_font_size numeric DEFAULT 32;
