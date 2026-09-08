-- ─────────────────────────────────────────────────────────────────────────────
-- Matchmaking Faza 7 — pgvector Architecture Preparation
--
-- STATUS: PREPARED — not active until ~100K users or significant matching
--         quality degradation. Do NOT generate embeddings yet.
--
-- Architecture overview:
--   1. Enable pgvector extension (safe, no performance cost)
--   2. Add nullable embedding columns to profiles and posts
--   3. Columns stay NULL until the embedding pipeline is activated
--   4. When ready: batch-generate embeddings → build HNSW index → swap RPC
--
-- Embedding model: text-embedding-3-small (OpenAI, 1536 dims, ~$0.02/1M tokens)
-- Alternative:     any future Anthropic embedding model
--
-- Activation checklist (do NOT activate early):
--   [ ] ~100K+ active profiles OR matching quality complaints
--   [ ] Embedding cron job implemented (lib/jobs/generate-embeddings.ts)
--   [ ] >80% of profiles have non-NULL embedding
--   [ ] HNSW index built (see commented CREATE INDEX below)
--   [ ] find_matching_profiles_vector() tested and benchmarked
--   [ ] Pipeline switched to vector path (VECTOR_PIPELINE_ENABLED=true env var)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- Profile embeddings: bio + skills + category concatenated, then embedded
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Post embeddings: job_title/profession + text + category concatenated, then embedded
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ── HNSW index (DO NOT CREATE until >80% of rows have embeddings) ─────────
-- This index is fast for ANN search but useless with mostly-NULL values.
-- Create it AFTER the batch embedding job has populated the columns:
--
-- CREATE INDEX profiles_embedding_hnsw_idx
--   ON profiles USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);
--
-- CREATE INDEX posts_embedding_hnsw_idx
--   ON posts USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);


-- ── Placeholder RPC (disabled — swap in pipeline when embeddings are ready) ─
-- When activated, this replaces find_matching_profiles() for semantic search:
--
-- CREATE OR REPLACE FUNCTION find_matching_profiles_vector(
--   p_query_embedding  vector(1536),
--   p_category         text    DEFAULT NULL,
--   p_city             text    DEFAULT NULL,
--   p_country          text    DEFAULT NULL,
--   p_exclude_ids      uuid[]  DEFAULT '{}',
--   p_limit            int     DEFAULT 100
-- )
-- RETURNS TABLE (
--   id             uuid,
--   name           text,
--   bio            text,
--   skills         jsonb,
--   category       text,
--   feed_interests text[],
--   city           text,
--   country        text,
--   preferred_language text,
--   average_rating numeric,
--   review_count   bigint,
--   last_seen      timestamptz,
--   is_premium     boolean,
--   portfolio_count bigint,
--   pre_score      int,
--   cosine_sim     float
-- )
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT
--     p.id, p.name, p.bio, p.skills, p.category, p.feed_interests,
--     p.city, p.country, p.preferred_language, p.average_rating,
--     p.review_count, p.last_seen, p.is_premium, p.portfolio_count,
--     50 AS pre_score,
--     (1 - (p.embedding <=> p_query_embedding))::float AS cosine_sim
--   FROM profiles p
--   WHERE p.embedding IS NOT NULL
--     AND (p_category IS NULL OR LOWER(p.category) = LOWER(p_category))
--     AND (p_city IS NULL OR LOWER(p.city) = LOWER(p_city))
--     AND NOT (p.id = ANY(p_exclude_ids))
--   ORDER BY p.embedding <=> p_query_embedding
--   LIMIT p_limit;
-- $$;
