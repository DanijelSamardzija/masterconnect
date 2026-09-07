import Anthropic from '@anthropic-ai/sdk'
import { extractionSchema, rankingSchema } from './types'
import type {
  ExtractionResult,
  CandidateSummary,
  PostSummary,
  RankedResult,
  MatchingAIProvider,
} from './types'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const LANG_LABELS: Record<string, string> = {
  sr: 'Serbian (Srpski)',
  en: 'English',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

export class AnthropicMatchingProvider implements MatchingAIProvider {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async extractRequirements(
    postText: string,
    postMeta: { category?: string | null; city?: string | null; country?: string | null },
  ): Promise<{ result: ExtractionResult; inputTokens: number; outputTokens: number }> {
    const sanitized = stripHtml(postText).slice(0, 1500)

    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      system: 'You are a job requirements extractor. Output only valid JSON matching the schema below. No markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content: `Extract requirements from this post.
<post_text>${sanitized}</post_text>
<post_category>${postMeta.category ?? 'unknown'}</post_category>
<post_city>${postMeta.city ?? 'not specified'}</post_city>
<post_country>${postMeta.country ?? 'not specified'}</post_country>

Output this exact JSON structure:
{
  "required_skills": ["skill1", "skill2"],
  "category_hint": "category-slug or null",
  "location_preference": { "city": "city name or null", "country": "country name or null" },
  "location_strict": false,
  "experience_level": "junior|mid|senior|expert or null",
  "budget_range": "description or null",
  "description_en": "English summary of the post (max 180 chars)",
  "post_lang": "sr|en|de|es|fr or detected code"
}`,
        },
      ],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}'
    const parsed = JSON.parse(stripJsonFences(raw))
    const result = extractionSchema.parse(parsed)

    return {
      result,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }

  async rankCandidates(
    extraction: ExtractionResult,
    candidates: CandidateSummary[],
    outputLang: string,
  ): Promise<{ ranked: RankedResult[]; inputTokens: number; outputTokens: number }> {
    const langLabel = LANG_LABELS[outputLang] ?? 'English'

    const candidateList = candidates
      .map((c) => `[${c.index}] ${c.name} | Skills: ${c.skills_text || 'none'} | ${c.bio_snippet || ''} | ${c.city ?? 'Remote'} | ⭐${c.rating?.toFixed(1) ?? 'N/A'}`)
      .join('\n')

    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      temperature: 0.3,
      system: 'You are a talent matching assistant. Output only valid JSON. No markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content: `Job/service description (English): <job>${extraction.description_en}</job>
Required skills: ${extraction.required_skills.join(', ') || 'not specified'}

Candidates:
${candidateList}

Select the top 5 best matches based on skills, experience, and relevance.
Write a concise 1-sentence reason for each in ${langLabel}.
Output JSON: {"ranked":[{"index":0,"rank":1,"reason":"..."},{"index":3,"rank":2,"reason":"..."},...]}`,
        },
      ],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{"ranked":[]}'
    const parsed = JSON.parse(stripJsonFences(raw))
    const { ranked } = rankingSchema.parse(parsed)

    return {
      ranked: ranked as RankedResult[],
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }

  async analyzeProfile(
    profileText: string,
    profileMeta: { category?: string | null; city?: string | null; country?: string | null },
  ): Promise<{ result: ExtractionResult; inputTokens: number; outputTokens: number }> {
    const sanitized = stripHtml(profileText).slice(0, 1500)

    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      system: 'You are a professional profile analyzer. Output only valid JSON matching the schema below. No markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content: `Analyze this professional profile and extract what they offer.
<profile_text>${sanitized}</profile_text>
<profile_category>${profileMeta.category ?? 'unknown'}</profile_category>
<profile_city>${profileMeta.city ?? 'not specified'}</profile_city>
<profile_country>${profileMeta.country ?? 'not specified'}</profile_country>

Output this exact JSON structure:
{
  "required_skills": ["skill1", "skill2"],
  "category_hint": "category-slug or null",
  "location_preference": { "city": "city name or null", "country": "country name or null" },
  "location_strict": false,
  "experience_level": "junior|mid|senior|expert or null",
  "budget_range": "hourly rate or price range they charge or null",
  "description_en": "English summary of what this professional offers (max 180 chars)",
  "post_lang": "sr|en|de|es|fr or detected code"
}`,
        },
      ],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}'
    const parsed = JSON.parse(stripJsonFences(raw))
    const result = extractionSchema.parse(parsed)

    return {
      result,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }

  async rankPostsForProfile(
    profileSummary: ExtractionResult,
    posts: PostSummary[],
    outputLang: string,
  ): Promise<{ ranked: RankedResult[]; inputTokens: number; outputTokens: number }> {
    const langLabel = LANG_LABELS[outputLang] ?? 'English'

    const postList = posts
      .map((p) => `[${p.index}] ${p.title} | Category: ${p.category ?? 'unknown'} | ${p.city ?? 'Remote'} | ${p.experience ?? 'any level'} | ${p.price_hint ?? 'price not specified'} | ${p.snippet}`)
      .join('\n')

    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      temperature: 0.3,
      system: 'You are a job matching assistant helping a professional find the best opportunities. Output only valid JSON. No markdown, no explanation.',
      messages: [
        {
          role: 'user',
          content: `Professional profile summary (English): <profile>${profileSummary.description_en}</profile>
Their skills: ${profileSummary.required_skills.join(', ') || 'not specified'}
Their experience: ${profileSummary.experience_level ?? 'not specified'}

Job/service request posts:
${postList}

Select the top 5 posts that best match this professional's skills and experience.
Write a concise 1-sentence reason for each in ${langLabel}, explaining why this post suits them.
Output JSON: {"ranked":[{"index":0,"rank":1,"reason":"..."},{"index":3,"rank":2,"reason":"..."},...]}`,
        },
      ],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{"ranked":[]}'
    const parsed = JSON.parse(stripJsonFences(raw))
    const { ranked } = rankingSchema.parse(parsed)

    return {
      ranked: ranked as RankedResult[],
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }
}
