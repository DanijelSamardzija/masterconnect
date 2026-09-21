-- Faza 1 (Majstori i Firme): Extend booking_profiles with trade-specific columns.
-- contact_channels stores WhatsApp/Viber/phone numbers for public display.
-- emergency_enabled flags whether this business accepts emergency requests.

ALTER TABLE booking_profiles
  ADD COLUMN IF NOT EXISTS contact_channels JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emergency_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN booking_profiles.contact_channels IS
  'Public contact channels for tradespeople: {whatsapp, viber, phone, ...}';
COMMENT ON COLUMN booking_profiles.emergency_enabled IS
  'When true, this business appears in emergency request flows and accepts urgent calls';
