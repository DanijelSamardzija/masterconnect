import type { CandidateProfile, ExtractionResult } from './types'

export interface ScoredCandidate extends CandidateProfile {
  total_score: number
}

// MAX_SCORE = 40+20+10+10+15+10+8+5 = 118
export const MAX_SCORE = 118

export function scoreCandidates(
  candidates: CandidateProfile[],
  extraction: ExtractionResult,
  topN = 20,
): ScoredCandidate[] {
  return candidates
    .map((c) => ({ ...c, total_score: computeScore(c, extraction) }))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, topN)
}

function computeScore(profile: CandidateProfile, extraction: ExtractionResult): number {
  return (
    skillOverlap(extraction.required_skills, profile.skills) * 40 +
    categoryExact(extraction.category_hint, profile.category) * 20 +
    categoryInterest(extraction.category_hint, profile.feed_interests) * 10 +
    locationScore(extraction, profile) +
    qualityScore(profile) +
    activityScore(profile) +
    behaviorScore(profile) +
    premiumBoost(profile)
  )
}

// Jaccard similarity between required skills and profile skills
function skillOverlap(required: string[], profileSkills: unknown): number {
  const profSet = normalizeSkillSet(profileSkills)
  if (!required.length || !profSet.size) return 0
  const reqSet = new Set(required.map((s) => s.toLowerCase()))
  let intersection = 0
  reqSet.forEach((s) => { if (profSet.has(s)) intersection++ })
  const union = reqSet.size + profSet.size - intersection
  return union === 0 ? 0 : intersection / union
}

function normalizeSkillSet(skills: unknown): Set<string> {
  const set = new Set<string>()
  if (!skills || !Array.isArray(skills)) return set
  for (const s of skills) {
    if (typeof s === 'string') set.add(s.toLowerCase())
    else if (typeof s === 'object' && s !== null && 'name' in s && typeof (s as any).name === 'string')
      set.add((s as any).name.toLowerCase())
  }
  return set
}

function categoryExact(hint: string | null | undefined, category: string | null | undefined): number {
  if (!hint || !category) return 0
  return hint.toLowerCase() === category.toLowerCase() ? 1 : 0
}

function categoryInterest(hint: string | null | undefined, interests: string[] | null | undefined): number {
  if (!hint || !interests?.length) return 0
  return interests.some((i) => i.toLowerCase() === hint.toLowerCase()) ? 1 : 0
}

function locationScore(extraction: ExtractionResult, profile: CandidateProfile): number {
  const city    = extraction.location_preference?.city?.toLowerCase()
  const country = extraction.location_preference?.country?.toLowerCase()
  if (city && profile.city?.toLowerCase().includes(city)) return 10
  if (country && profile.country?.toLowerCase().includes(country)) return 7
  return extraction.location_strict ? 0 : 3
}

function qualityScore(profile: CandidateProfile): number {
  const rating = profile.average_rating ?? 0
  const count  = profile.review_count ?? 0
  return Math.min(15, rating * 3 + Math.log2(count + 1))
}

function activityScore(profile: CandidateProfile): number {
  if (!profile.last_seen) return 0
  const days = (Date.now() - new Date(profile.last_seen).getTime()) / 86_400_000
  if (days < 7)  return 10
  if (days < 30) return 7
  if (days < 90) return 3
  return 0
}

function behaviorScore(profile: CandidateProfile): number {
  const portfolios = profile.portfolio_count ?? 0
  const reviews    = profile.review_count ?? 0
  return Math.min(8, portfolios * 2 + reviews * 0.5)
}

function premiumBoost(profile: CandidateProfile): number {
  return profile.is_premium ? 5 : 0
}

export function normalizedScore(total: number): number {
  return Math.round((total / MAX_SCORE) * 100)
}

export function normalizeSkillsText(skills: unknown): string {
  if (!skills || !Array.isArray(skills)) return ''
  return skills
    .map((s) => (typeof s === 'string' ? s : (s as any)?.name || ''))
    .filter(Boolean)
    .join(', ')
}
