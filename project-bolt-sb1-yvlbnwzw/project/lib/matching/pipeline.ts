import type { SupabaseClient } from '@supabase/supabase-js'
import { AnthropicMatchingProvider } from './anthropic-provider'
import { scoreCandidates, normalizeSkillsText, normalizedScore } from './scorer'
import type {
  PipelineInput,
  PipelineResult,
  CandidateProfile,
  CandidateSummary,
  RankedProfile,
} from './types'

// Haiku pricing (USD per token) as of 2025
function safeName(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.includes('@') ? null : raw
}
const HAIKU_INPUT_COST  = 0.00000080  // $0.80  per 1M input tokens
const HAIKU_OUTPUT_COST = 0.00000400  // $4.00  per 1M output tokens

function computeCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * HAIKU_INPUT_COST + outputTokens * HAIKU_OUTPUT_COST
}

export async function runMatchingPipeline(
  supabase: SupabaseClient,
  input: PipelineInput,
): Promise<PipelineResult> {
  const startAt = Date.now()
  const provider = new AnthropicMatchingProvider()

  let totalInputTokens  = 0
  let totalOutputTokens = 0

  // ── Step 2: Extract structured requirements (Haiku Call 1) ───────────────
  const postTextCombined = [input.post_text, (input as any).job_title, (input as any).profession]
    .filter(Boolean)
    .join(' ')

  const { result: extraction, inputTokens: ext_in, outputTokens: ext_out } =
    await provider.extractRequirements(postTextCombined, {
      category: input.post_category,
      city:     input.post_city,
      country:  input.post_country,
    })
  totalInputTokens  += ext_in
  totalOutputTokens += ext_out

  // ── Step 3: DB pre-filter via find_matching_profiles RPC ─────────────────
  const { data: rawCandidates, error: dbError } = await supabase.rpc(
    'find_matching_profiles',
    {
      p_skills:          extraction.required_skills,
      p_category:        extraction.category_hint ?? input.post_category ?? null,
      p_city:            extraction.location_preference?.city    ?? input.post_city    ?? null,
      p_country:         extraction.location_preference?.country ?? input.post_country ?? null,
      p_location_strict: extraction.location_strict,
      p_exclude_ids:     input.exclude_ids,
      p_limit:           100,
    } as any,
  )

  if (dbError) throw new Error(`DB pre-filter failed: ${dbError.message}`)

  // ── Fetch active boosts to include in scoring (Faza 3) ───────────────────
  const { data: activeBoosts } = await supabase
    .from('matchmaking_boosts')
    .select('profile_id, boost_score')
    .gt('valid_until', new Date().toISOString())

  const boostMap = new Map<string, number>(
    (activeBoosts ?? []).map((b) => [b.profile_id as string, b.boost_score as number]),
  )

  const candidates: CandidateProfile[] = ((rawCandidates as CandidateProfile[]) ?? []).map((c) => ({
    ...c,
    boost_score: boostMap.get(c.id) ?? 0,
  }))

  if (candidates.length === 0) {
    return {
      extraction,
      ranked_profiles:   [],
      candidate_count:   0,
      totalInputTokens,
      totalOutputTokens,
      costUsd:   computeCost(totalInputTokens, totalOutputTokens),
      durationMs: Date.now() - startAt,
    }
  }

  // ── Step 4: Deterministic scorer → top 20 (no AI cost) ───────────────────
  const scored = scoreCandidates(candidates, extraction, 20)

  // ── Step 5: Semantic ranking (Haiku Call 2) ───────────────────────────────
  const summaries: CandidateSummary[] = scored.map((c, i) => ({
    index:       i,
    name:        safeName(c.name) ?? 'Professional',
    skills_text: normalizeSkillsText(c.skills),
    bio_snippet: (c.bio ?? '').slice(0, 150),
    city:        c.city ?? null,
    rating:      c.average_rating ?? null,
  }))

  let rankedResults: { index: number; rank: number; reason: string }[] = []
  let rank_in = 0
  let rank_out = 0

  try {
    const { ranked, inputTokens, outputTokens } = await provider.rankCandidates(
      extraction,
      summaries,
      input.requester_lang,
    )
    rankedResults = ranked as typeof rankedResults
    rank_in  = inputTokens
    rank_out = outputTokens
  } catch {
    // Fallback: use deterministic top 5 with generic reason
    rankedResults = scored.slice(0, 5).map((_, i) => ({
      index:  i,
      rank:   i + 1,
      reason: '',
    }))
  }
  totalInputTokens  += rank_in
  totalOutputTokens += rank_out

  // ── Map ranked indices back to full profile data ──────────────────────────
  const top5: RankedProfile[] = rankedResults
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .flatMap((r) => {
      const profile = scored[r.index]
      if (!profile) return []
      return [{
        profile_id:     profile.id,
        name:           safeName(profile.name),
        city:           profile.city,
        country:        profile.country,
        average_rating: profile.average_rating,
        review_count:   profile.review_count,
        skills:         profile.skills,
        is_premium:     profile.is_premium,
        total_score:    normalizedScore(profile.total_score),
        rank:           r.rank,
        reason:         r.reason,
      }]
    })

  return {
    extraction,
    ranked_profiles:   top5,
    candidate_count:   candidates.length,
    totalInputTokens,
    totalOutputTokens,
    costUsd:    computeCost(totalInputTokens, totalOutputTokens),
    durationMs: Date.now() - startAt,
  }
}
