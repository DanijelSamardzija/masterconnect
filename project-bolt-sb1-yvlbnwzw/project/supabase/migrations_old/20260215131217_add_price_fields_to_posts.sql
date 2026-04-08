/*
  # Add price fields to posts table

  1. Changes
    - Add `price_type` column to posts table for service_listing posts
    - Add `price_value` column to posts table for service_listing posts
    - price_type options: 'negotiable', 'hourly', 'fixed'
    - price_value stores the numeric price when applicable
    
  2. Notes
    - These fields are optional (NULL allowed) since not all post types need pricing
    - price_type indicates how the service is priced
    - price_value is only used when price_type is 'hourly' or 'fixed'
*/

-- Add price_type column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS price_type text;

-- Add price_value column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS price_value numeric;

-- Add comments to explain the columns
COMMENT ON COLUMN posts.price_type IS 'Pricing type for service_listing posts: negotiable, hourly, or fixed';
COMMENT ON COLUMN posts.price_value IS 'Numeric price value when price_type is hourly or fixed';
