/*
  # Add Currency Field to Posts

  1. Changes
    - Add `currency` column to `posts` table
      - Stores the currency for price (RSD, EUR, USD)
      - NOT NULL with default 'RSD'
      - Used in combination with price_value and price_type
  
  2. Notes
    - Currency is required when price is specified
    - Supports RSD, EUR, and USD
    - Default is RSD for existing posts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE posts ADD COLUMN currency text NOT NULL DEFAULT 'RSD';
  END IF;
END $$;

COMMENT ON COLUMN posts.currency IS 'Currency for the price (RSD, EUR, USD)';