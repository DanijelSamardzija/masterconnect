-- Faza 1 (Majstori i Firme): Extend existing tradesperson tables.
--
-- tradesperson_services: add 'project' to price_type CHECK so fixed-scope
-- project contracts can be quoted as a single lump sum.
--
-- tradesperson_requests: add emergency flag and extra contact channels
-- (video_url, whatsapp, viber) so clients can attach a short video of the
-- problem and choose their preferred contact method on the request form.

-- 1. tradesperson_services — add 'project' price type
ALTER TABLE tradesperson_services
  DROP CONSTRAINT IF EXISTS tradesperson_services_price_type_check;

ALTER TABLE tradesperson_services
  ADD CONSTRAINT tradesperson_services_price_type_check
  CHECK (price_type IN ('quote', 'hourly', 'fixed', 'project'));

-- 2. tradesperson_requests — add emergency + contact channel columns
ALTER TABLE tradesperson_requests
  ADD COLUMN IF NOT EXISTS is_emergency   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_url      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS viber          TEXT;

CREATE INDEX IF NOT EXISTS tradesperson_requests_is_emergency_idx
  ON tradesperson_requests (business_id, is_emergency)
  WHERE is_emergency = true;
