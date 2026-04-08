/*
  # Update Offers Table for Service Request Support

  1. Changes to `offers` table
    - Add `offer_type` (text) - Type: "job" or "service"
    - Add `price_type` (text, nullable) - Type: "fixed" or "per_hour"
    - Update constraints to allow both job and service offers
    - Rename fields for better clarity (keep backward compatibility)

  2. Notes
    - `offer_type`: "job" = offer to job seeker, "service" = offer to provide service
    - `price_type`: "fixed" for one-time price, "per_hour" for hourly rate
    - All existing offers default to "job" type for backward compatibility
*/

-- Add offer_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'offer_type'
  ) THEN
    ALTER TABLE offers ADD COLUMN offer_type text NOT NULL DEFAULT 'job' CHECK (offer_type IN ('job', 'service'));
  END IF;
END $$;

-- Add price_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offers' AND column_name = 'price_type'
  ) THEN
    ALTER TABLE offers ADD COLUMN price_type text DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'per_hour'));
  END IF;
END $$;

-- Create index for offer_type
CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(offer_type);

-- Update check constraint to allow both types
DO $$
BEGIN
  ALTER TABLE offers DROP CONSTRAINT IF EXISTS valid_currency;
  ALTER TABLE offers ADD CONSTRAINT valid_currency CHECK (currency IN ('RSD', 'EUR', 'USD'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;