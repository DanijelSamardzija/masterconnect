ALTER TABLE profiles ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS utm_campaign text;
