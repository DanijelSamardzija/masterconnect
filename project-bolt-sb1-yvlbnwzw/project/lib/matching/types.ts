import { z } from 'zod'

// ── Zod schemas (validate AI output) ──────────────────────────────────────

export const extractionSchema = z.object({
  required_skills:     z.array(z.string()).default([]),
  category_hint:       z.string().nullable().optional(),
  location_preference: z.object({
    city:    z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  }).optional(),
  location_strict: z.boolean().default(false),
  experience_level: z.string().nullable().optional(),
  budget_range:     z.string().nullable().optional(),
  description_en:   z.string().default(''),
  post_lang:        z.string().default('sr'),
})

export const rankingSchema = z.object({
  ranked: z.array(z.object({
    index:  z.number(),
    rank:   z.number(),
    reason: z.string(),
  })),
})

// ── Core types ─────────────────────────────────────────────────────────────

export type ExtractionResult = z.infer<typeof extractionSchema>

export interface CandidateProfile {
  id:                 string
  name:               string | null
  bio:                string | null
  skills:             unknown          // jsonb — normalised in scorer
  category:           string | null
  feed_interests:     string[] | null
  city:               string | null
  country:            string | null
  preferred_language: string | null
  average_rating:     number | null
  review_count:       number | null
  last_seen:          string | null    // ISO timestamp
  is_premium:         boolean | null
  portfolio_count:    number | null
  pre_score:          number           // from RPC pre-filter
  total_score?:       number           // added by scorer
  boost_score?:       number           // from matchmaking_boosts if active (Faza 3)
}

export interface CandidateSummary {
  index:       number
  name:        string
  skills_text: string
  bio_snippet: string
  city:        string | null
  rating:      number | null
}

export interface RankedResult {
  index:  number
  rank:   number
  reason: string
}

export interface RankedProfile {
  profile_id:     string
  name:           string | null
  city:           string | null
  country:        string | null
  average_rating: number | null
  review_count:   number | null
  skills:         unknown
  is_premium:     boolean | null
  total_score:    number
  rank:           number
  reason:         string
}

export interface PipelineInput {
  post_id:       string
  post_text:     string
  post_category: string | null
  post_city:     string | null
  post_country:  string | null
  post_type:     string
  exclude_ids:   string[]
  requester_lang: string
}

export interface PipelineResult {
  extraction:       ExtractionResult
  ranked_profiles:  RankedProfile[]
  candidate_count:  number
  totalInputTokens: number
  totalOutputTokens: number
  costUsd:          number
  durationMs:       number
}

// ── AI provider interface (model-agnostic) ─────────────────────────────────

export interface MatchingAIProvider {
  extractRequirements(
    postText: string,
    postMeta: { category?: string | null; city?: string | null; country?: string | null }
  ): Promise<{ result: ExtractionResult; inputTokens: number; outputTokens: number }>

  rankCandidates(
    extraction: ExtractionResult,
    candidates: CandidateSummary[],
    outputLang: string
  ): Promise<{ ranked: RankedResult[]; inputTokens: number; outputTokens: number }>

  analyzeProfile(
    profileText: string,
    profileMeta: { category?: string | null; city?: string | null; country?: string | null }
  ): Promise<{ result: ExtractionResult; inputTokens: number; outputTokens: number }>

  rankPostsForProfile(
    profileSummary: ExtractionResult,
    posts: PostSummary[],
    outputLang: string
  ): Promise<{ ranked: RankedResult[]; inputTokens: number; outputTokens: number }>
}

// ── Reverse Matching types (F5) ────────────────────────────────────────────

export interface PostCandidate {
  id:               string
  job_title:        string | null
  profession:       string | null
  text_snippet:     string | null
  post_type:        string
  category:         string | null
  city:             string | null
  country:          string | null
  min_price:        number | null
  max_price:        number | null
  price_type:       string | null
  currency:         string | null
  experience_level: string | null
  created_at:       string | null
  owner_id:         string
  owner_name:       string | null
  pre_score:        number
  total_score?:     number
}

export interface PostSummary {
  index:        number
  title:        string
  snippet:      string
  category:     string | null
  city:         string | null
  experience:   string | null
  price_hint:   string | null
}

export interface RankedPost {
  post_id:          string
  job_title:        string | null
  profession:       string | null
  text_snippet:     string | null
  post_type:        string
  category:         string | null
  city:             string | null
  country:          string | null
  min_price:        number | null
  max_price:        number | null
  currency:         string | null
  experience_level: string | null
  created_at:       string | null
  owner_name:       string | null
  total_score:      number
  rank:             number
  reason:           string
}

export interface ReversePipelineInput {
  profile_id:     string
  requester_lang: string
  exclude_ids?:   string[]
}

export interface ReversePipelineResult {
  ranked_posts:      RankedPost[]
  candidate_count:   number
  totalInputTokens:  number
  totalOutputTokens: number
  costUsd:           number
  durationMs:        number
}
