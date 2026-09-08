/**
 * pgvector Architecture — Phase 7 Stub
 *
 * STATUS: PREPARED — NOT ACTIVE until ~100K+ users or significant AI matching
 *         quality degradation. Do not call any function here in production.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHEN TO ACTIVATE
 * ─────────────────────────────────────────────────────────────────────────────
 * The current Haiku-based pipeline (Phases 1-6) handles thousands of users
 * efficiently. Activate pgvector when:
 *   - The candidate pool regularly exceeds 5,000 profiles/posts
 *   - Haiku API costs become prohibitive
 *   - ANN search latency is needed for < 50ms p99 matching
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EMBEDDING MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * Recommended: OpenAI text-embedding-3-small (1536 dims, ~$0.02/1M tokens)
 * Alternative:  Any future Anthropic embedding model
 *
 * Profile text to embed:
 *   `${bio ?? ''} ${skills?.join(' ')} ${category} ${work_categories?.join(' ')} ${city} ${country}`
 *
 * Post text to embed:
 *   `${job_title ?? profession ?? ''} ${text?.slice(0, 500)} ${category} ${city} ${country}`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HNSW INDEX (create AFTER >80% of rows have embeddings)
 * ─────────────────────────────────────────────────────────────────────────────
 * See migration 20260908000001_matchmaking_faza7_pgvector.sql for the
 * commented-out CREATE INDEX statements. Do NOT create before batch generation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACTIVATION STEPS
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Implement lib/jobs/generate-embeddings.ts (batch cron, e.g. Inngest)
 *   2. Run batch until >80% of profiles and posts have non-NULL embeddings
 *   3. Uncomment HNSW CREATE INDEX in the F7 migration and apply it
 *   4. Uncomment find_matching_profiles_vector() RPC in the F7 migration
 *   5. Set env var VECTOR_PIPELINE_ENABLED=true on Vercel
 *   6. In forward-pipeline.ts: check env var → call find_matching_profiles_vector()
 *      instead of find_matching_profiles()
 *   7. Benchmark and A/B test both paths before full cutover
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE FUNCTION SIGNATURES (implement when activating)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type EmbeddingVector = number[]; // 1536 dimensions

/**
 * Generate an embedding for a profile's text representation.
 * NOT IMPLEMENTED — add OpenAI SDK call when activating.
 */
export async function embedProfile(
  _bio: string | null,
  _skills: string[],
  _category: string | null,
  _workCategories: string[],
  _city: string | null,
  _country: string | null,
): Promise<EmbeddingVector> {
  throw new Error('Vector pipeline not yet active. See lib/matching/vector-pipeline.ts');
}

/**
 * Generate an embedding for a post's text representation.
 * NOT IMPLEMENTED — add OpenAI SDK call when activating.
 */
export async function embedPost(
  _title: string | null,
  _text: string | null,
  _category: string | null,
  _city: string | null,
  _country: string | null,
): Promise<EmbeddingVector> {
  throw new Error('Vector pipeline not yet active. See lib/matching/vector-pipeline.ts');
}

/**
 * Serialise a number[] to the Postgres vector literal format "[0.1,0.2,...]".
 * Use this before writing to profiles.embedding or posts.embedding.
 */
export function vectorToString(v: EmbeddingVector): string {
  return `[${v.join(',')}]`;
}
