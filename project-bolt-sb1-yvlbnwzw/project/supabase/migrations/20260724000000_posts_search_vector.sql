-- Full Text Search: add weighted search_vector generated column to posts
--
-- Weights:
--   A = job_title, profession  (most specific — what the user offers)
--   B = category, city, country (context)
--   C = text                    (description — full text, lower priority)
--
-- Uses 'simple' dictionary: lowercases + strips accents, works for SR/EN/DE.
-- No stemming needed — prefix matching (:*) handles partial words.
--
-- NOTE: Adding a STORED generated column rewrites the table.
-- Run during a low-traffic window on large datasets.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(job_title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(profession, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(country, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(text, '')), 'C')
) STORED;

-- GIN index: O(log N) FTS lookups even on millions of rows
CREATE INDEX IF NOT EXISTS posts_search_vector_gin_idx
ON posts USING GIN (search_vector);
