-- Add website_url, show_phone, show_email to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS website_url  text,
  ADD COLUMN IF NOT EXISTS show_phone   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_email   boolean NOT NULL DEFAULT false;
