import type { SupabaseClient } from '@supabase/supabase-js'
import { AnthropicMatchingProvider } from './anthropic-provider'
import { scorePosts, buildPostSummaries, normalizedPostScore } from './post-scorer'
import { normalizeSkillsText } from './scorer'
import type {
  PostCandidate,
  RankedPost,
  ReversePipelineInput,
  ReversePipelineResult,
} from './types'

const HAIKU_INPUT_COST  = 0.00000080
const HAIKU_OUTPUT_COST = 0.00000400

function computeCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * HAIKU_INPUT_COST + outputTokens * HAIKU_OUTPUT_COST
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function runReversePipeline(
  supabase: SupabaseClient,
  input: ReversePipelineInput,
): Promise<ReversePipelineResult> {
  const startAt = Date.now()
  const provider = new AnthropicMatchingProvider()

  let totalInputTokens  = 0
  let totalOutputTokens = 0

  // ── Step 1: Fetch professional's profile ─────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('bio, skills, category, work_categories, city, country, experience_level, availability')
    .eq('id', input.profile_id)
    .single()

  if (profileError || !profile) {
    throw new Error('Profile not found')
  }

  // ── Step 2: Build profile text for Haiku analysis ─────────────────────────
  const skillsText = normalizeSkillsText(profile.skills)
  const workCats   = Array.isArray(profile.work_categories) ? profile.work_categories.join(', ') : ''
  const profileText = [
    profile.bio,
    skillsText ? `Skills: ${skillsText}` : null,
    workCats    ? `Work categories: ${workCats}` : null,
    profile.experience_level ? `Experience: ${profile.experience_level}` : null,
    profile.availability ? `Availability: ${profile.availability}` : null,
  ].filter(Boolean).join('. ')

  // ── Step 3: Haiku Call 1 — analyze profile offering ──────────────────────
  const { result: profileSummary, inputTokens: ana_in, outputTokens: ana_out } =
    await provider.analyzeProfile(stripHtml(profileText), {
      category: profile.category,
      city:     profile.city,
      country:  profile.country,
    })
  totalInputTokens  += ana_in
  totalOutputTokens += ana_out

  // ── Step 4: DB pre-filter via find_matching_posts_for_profile RPC ─────────
  const { data: rawPosts, error: dbError } = await supabase.rpc(
    'find_matching_posts_for_profile',
    {
      p_profile_id:  input.profile_id,
      p_limit:       100,
      p_exclude_ids: input.exclude_ids ?? [],
    } as any,
  )

  if (dbError) throw new Error(`DB pre-filter failed: ${dbError.message}`)

  const candidates: PostCandidate[] = (rawPosts as PostCandidate[]) ?? []

  if (candidates.length === 0) {
    return {
      ranked_posts:      [],
      candidate_count:   0,
      totalInputTokens,
      totalOutputTokens,
      costUsd:           computeCost(totalInputTokens, totalOutputTokens),
      durationMs:        Date.now() - startAt,
    }
  }

  // ── Step 5: Deterministic scorer → top 20 ────────────────────────────────
  const scored = scorePosts(candidates, profileSummary, 20)
  const summaries = buildPostSummaries(scored)

  // ── Step 6: Haiku Call 2 — semantic ranking of posts ─────────────────────
  let rankedResults: { index: number; rank: number; reason: string }[] = []
  let rank_in = 0
  let rank_out = 0

  try {
    const { ranked, inputTokens, outputTokens } = await provider.rankPostsForProfile(
      profileSummary,
      summaries,
      input.requester_lang,
    )
    rankedResults = ranked as typeof rankedResults
    rank_in  = inputTokens
    rank_out = outputTokens
  } catch {
    // Fallback: deterministic top 5
    rankedResults = scored.slice(0, 5).map((_, i) => ({
      index:  i,
      rank:   i + 1,
      reason: '',
    }))
  }
  totalInputTokens  += rank_in
  totalOutputTokens += rank_out

  // ── Step 7: Map ranked indices back to full post data ─────────────────────
  const top5: RankedPost[] = rankedResults
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .flatMap((r) => {
      const post = scored[r.index]
      if (!post) return []
      return [{
        post_id:          post.id,
        job_title:        post.job_title,
        profession:       post.profession,
        text_snippet:     post.text_snippet,
        post_type:        post.post_type,
        category:         post.category,
        city:             post.city,
        country:          post.country,
        min_price:        post.min_price,
        max_price:        post.max_price,
        currency:         post.currency,
        experience_level: post.experience_level,
        created_at:       post.created_at,
        owner_name:       post.owner_name,
        total_score:      normalizedPostScore(post.total_score),
        rank:             r.rank,
        reason:           r.reason,
      }]
    })

  return {
    ranked_posts:      top5,
    candidate_count:   candidates.length,
    totalInputTokens,
    totalOutputTokens,
    costUsd:           computeCost(totalInputTokens, totalOutputTokens),
    durationMs:        Date.now() - startAt,
  }
}
