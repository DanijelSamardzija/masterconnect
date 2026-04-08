/*
  # Add category normalization support

  1. Changes
    - Add `category_normalized` column to posts table
    - Add `category_normalized` column to jobs table
    - Create function to normalize category text (lowercase, remove diacritics)
    - Add indexes for better search performance

  2. Purpose
    - Enable better searching and grouping of categories
    - Allow case-insensitive and diacritic-insensitive matching
    - Improve user experience when selecting categories
*/

-- Add category_normalized column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS category_normalized text;

-- Add category_normalized column to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS category_normalized text;

-- Create function to normalize text (lowercase + remove diacritics)
CREATE OR REPLACE FUNCTION normalize_category(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Lowercase and transliterate common Serbian Cyrillic/Latin diacritics
  RETURN lower(
    translate(
      input_text,
      'ĐđŠšČčĆćŽž',
      'ddsscccczzz'
    )
  );
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_category_normalized ON posts(category_normalized) WHERE category_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_category_normalized ON jobs(category_normalized) WHERE category_normalized IS NOT NULL;

-- Populate category_normalized for existing records in posts
UPDATE posts
SET category_normalized = normalize_category(profession)
WHERE profession IS NOT NULL AND category_normalized IS NULL;

-- Populate category_normalized for existing records in jobs
UPDATE jobs
SET category_normalized = normalize_category(category)
WHERE category IS NOT NULL AND category_normalized IS NULL;