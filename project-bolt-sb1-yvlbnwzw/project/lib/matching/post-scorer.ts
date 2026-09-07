import type { PostCandidate, PostSummary } from './types'
import type { ExtractionResult } from './types'

export interface ScoredPost extends PostCandidate {
  total_score: number
}

// MAX_SCORE: category(4+2) + location(2+1) + recency(2) = 11 raw → normalised to 100
const MAX_RAW_SCORE = 11

export function scorePosts(
  posts: PostCandidate[],
  profileSummary: ExtractionResult,
  topN = 20,
): ScoredPost[] {
  return posts
    .map((p) => ({ ...p, total_score: computePostScore(p, profileSummary) }))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, topN)
}

function computePostScore(post: PostCandidate, profile: ExtractionResult): number {
  const categoryHint = profile.category_hint?.toLowerCase()
  const postCat = post.category?.toLowerCase()
  const catExact = categoryHint && postCat && categoryHint === postCat ? 4 : 0

  const prefCity    = profile.location_preference?.city?.toLowerCase()
  const prefCountry = profile.location_preference?.country?.toLowerCase()
  const cityMatch   = prefCity && post.city?.toLowerCase().includes(prefCity) ? 2 : 0
  const countryMatch = !cityMatch && prefCountry && post.country?.toLowerCase().includes(prefCountry) ? 1 : 0

  const ageDays = post.created_at
    ? (Date.now() - new Date(post.created_at).getTime()) / 86_400_000
    : 999
  const recency = ageDays < 7 ? 2 : ageDays < 30 ? 1 : 0

  const raw = catExact + cityMatch + countryMatch + recency
  return Math.round((raw / MAX_RAW_SCORE) * 100)
}

export function normalizedPostScore(total: number): number {
  return Math.min(100, Math.max(0, total))
}

export function buildPostSummaries(posts: ScoredPost[]): PostSummary[] {
  return posts.map((p, i) => {
    const title = p.job_title ?? p.profession ?? p.post_type
    const priceHint = p.min_price != null
      ? `${p.min_price}${p.max_price ? '–' + p.max_price : ''}+ ${p.currency ?? ''}`.trim()
      : null
    return {
      index:      i,
      title,
      snippet:    (p.text_snippet ?? '').slice(0, 150),
      category:   p.category,
      city:       p.city,
      experience: p.experience_level,
      price_hint: priceHint,
    }
  })
}
