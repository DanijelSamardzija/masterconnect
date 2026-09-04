ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS body_es  text,
  ADD COLUMN IF NOT EXISTS title_fr text,
  ADD COLUMN IF NOT EXISTS body_fr  text;
