ALTER TABLE posts ADD COLUMN IF NOT EXISTS country text;
CREATE INDEX IF NOT EXISTS idx_posts_country ON posts(country);
