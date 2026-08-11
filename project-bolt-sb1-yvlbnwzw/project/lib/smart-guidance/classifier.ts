import Anthropic from '@anthropic-ai/sdk';
import type {
  GuidanceIntent,
  GuidanceLanguage,
  GuidancePostType,
  GuidanceType,
  HaikuClassification,
  ClassificationResult,
  PostMetadata,
} from './types';
import { LOCATION_SENSITIVE_TYPES } from './metadata-check';

const CONFIDENCE_THRESHOLD = 0.80;

// Maps detected intent → the "correct" post_type for that intent
const INTENT_TO_SECTION: Record<GuidanceIntent, GuidancePostType> = {
  SEEKING_JOB:       'job_seeker_post',
  HIRING:            'hiring_post',
  OFFERING_SERVICE:  'service_listing',
  SEEKING_SERVICE:   'service_request',
  PORTFOLIO:         'portfolio_post',
  SOCIAL:            'social_post',
};

// Intents where section mismatch matters enough to send guidance
const ACTIONABLE_INTENTS = new Set<GuidanceIntent>([
  'SEEKING_JOB',
  'HIRING',
  'OFFERING_SERVICE',
  'SEEKING_SERVICE',
]);

// Post types that are acceptable "home" for a given intent (no mismatch)
const ACCEPTABLE_SECTIONS: Partial<Record<GuidanceIntent, Set<string>>> = {
  PORTFOLIO: new Set(['portfolio_post', 'social_post']),
  SOCIAL:    new Set(['social_post', 'portfolio_post']),
};

function getRecommendedSection(
  intent: GuidanceIntent,
  currentPostType: string
): GuidancePostType | null {
  const acceptable = ACCEPTABLE_SECTIONS[intent];
  if (acceptable?.has(currentPostType)) return null;

  const recommended = INTENT_TO_SECTION[intent];
  if (recommended === currentPostType) return null;

  // Only return recommendation for actionable intents
  if (!ACTIONABLE_INTENTS.has(intent)) return null;

  return recommended;
}

// Raw JSON shape returned by Claude Haiku (snake_case)
interface HaikuRawResponse {
  detected_language: string;
  intent: string;
  missing_fields: string[];
  confidence: number;
}

async function classifyWithHaiku(
  text: string,
  postType: string
): Promise<HaikuClassification | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[SmartGuidance] ANTHROPIC_API_KEY not set');
    return null;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You classify social media posts from a job/service platform.
Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = `Classify this post.

Current section: ${postType}
Post text: ${text.slice(0, 800)}

Return JSON:
{
  "detected_language": "sr" or "en" or "de",
  "intent": "SEEKING_JOB" or "HIRING" or "OFFERING_SERVICE" or "SEEKING_SERVICE" or "PORTFOLIO" or "SOCIAL",
  "missing_fields": [],
  "confidence": 0.0
}

Intent definitions:
- SEEKING_JOB: person seeking employment
- HIRING: employer seeking workers
- OFFERING_SERVICE: person/company offering a service to clients
- SEEKING_SERVICE: person looking for a service provider
- PORTFOLIO: showcasing completed work/projects
- SOCIAL: general content, personal post, news

missing_fields: include only fields that are clearly absent AND would be useful:
- "city" if no location is mentioned and post type benefits from it
- "contact" if no phone/email/website is mentioned and it's a service/job post
- "description" if the text is very short (under 30 characters) for a service/job post

confidence: 0.0–1.0, your certainty about the intent. Use lower values when text is ambiguous.`;

  try {
    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const raw = JSON.parse(rawText.trim()) as HaikuRawResponse;

    // Validate fields
    const validIntents: GuidanceIntent[] = [
      'SEEKING_JOB', 'HIRING', 'OFFERING_SERVICE', 'SEEKING_SERVICE', 'PORTFOLIO', 'SOCIAL',
    ];
    const validLangs: GuidanceLanguage[] = ['sr', 'en', 'de'];

    if (!validIntents.includes(raw.intent as GuidanceIntent)) return null;
    if (typeof raw.confidence !== 'number') return null;

    const detectedLanguage: GuidanceLanguage = validLangs.includes(raw.detected_language as GuidanceLanguage)
      ? (raw.detected_language as GuidanceLanguage)
      : 'sr';

    const missingFields = Array.isArray(raw.missing_fields)
      ? raw.missing_fields.filter(f => ['city', 'contact', 'description'].includes(f))
      : [];

    return {
      detectedLanguage,
      intent: raw.intent as GuidanceIntent,
      missingFields,
      confidence: raw.confidence,
    };
  } catch (err) {
    console.error('[SmartGuidance] Haiku classification error:', err);
    return null;
  }
}

async function extractTextFromImage(
  imageUrl: string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!process.env.SMART_GUIDANCE_VISION_ENABLED || process.env.SMART_GUIDANCE_VISION_ENABLED !== 'true') {
    return null;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `Does this image contain significant text (like an advertisement, job posting, or service offer)?

Return JSON only:
{
  "has_text": true or false,
  "summary": "brief summary of the text content (max 150 chars, empty string if no text)",
  "confidence": 0.0
}

If unsure, set confidence below 0.6 and has_text to false.`,
          },
        ],
      }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(rawText.trim()) as { has_text: boolean; summary: string; confidence: number };

    if (!parsed.has_text || parsed.confidence < 0.65) return null;
    return parsed.summary || null;
  } catch {
    return null;
  }
}

export async function classifyPost(meta: PostMetadata): Promise<ClassificationResult> {
  // Skip classification for posts with no text AND no images
  if (meta.textLength === 0 && !meta.hasImages) {
    return {
      detectedLanguage: meta.profilePreferredLanguage ?? 'sr',
      detectedIntent: 'SOCIAL',
      recommendedSection: null,
      sectionMismatch: false,
      missingFields: [],
      hasImageOnly: false,
      confidence: 1,
      guidanceType: 'no_action',
      shouldSend: false,
    };
  }

  // Image-only: run vision if enabled, then classify text from image (or skip text AI)
  let imageExtractedText: string | undefined;
  if (meta.isImageOnly && meta.imageUrls.length > 0) {
    const extracted = await extractTextFromImage(meta.imageUrls[0]);
    imageExtractedText = extracted ?? undefined;
  }

  // Classify text (use extracted image text as supplement if post text is empty)
  const textToClassify = meta.text || imageExtractedText || '';

  let haiku: HaikuClassification | null = null;
  if (textToClassify.length > 5) {
    haiku = await classifyWithHaiku(textToClassify, meta.postType);
  }

  // Language: Priority 1 = Haiku detection, Priority 2 = profile preference, Priority 3 = 'sr'
  const detectedLanguage: GuidanceLanguage =
    haiku?.detectedLanguage ??
    meta.profilePreferredLanguage ??
    'sr';

  const intent: GuidanceIntent = haiku?.intent ?? 'SOCIAL';
  const confidence = haiku?.confidence ?? 0;
  const missingFields = haiku?.missingFields ?? [];

  // Add city to missing fields if location-sensitive and city is null
  if (
    LOCATION_SENSITIVE_TYPES.has(meta.postType) &&
    !meta.city &&
    !missingFields.includes('city')
  ) {
    missingFields.push('city');
  }

  const recommendedSection = getRecommendedSection(intent, meta.postType);
  const sectionMismatch = !!recommendedSection;
  const hasImageOnly = meta.isImageOnly;

  // Determine guidance type
  let guidanceType: GuidanceType = 'no_action';
  if (hasImageOnly && sectionMismatch) {
    guidanceType = 'wrong_section_and_missing';
  } else if (hasImageOnly) {
    guidanceType = 'image_only';
  } else if (sectionMismatch && missingFields.length > 0) {
    guidanceType = 'wrong_section_and_missing';
  } else if (sectionMismatch) {
    guidanceType = 'wrong_section';
  } else if (missingFields.length > 0 && LOCATION_SENSITIVE_TYPES.has(meta.postType)) {
    guidanceType = 'missing_content';
  }

  // Only send if there's a clear actionable reason and confidence is high enough
  const hasActionableGuidance = guidanceType !== 'no_action';
  const shouldSend = hasActionableGuidance && confidence >= CONFIDENCE_THRESHOLD;

  return {
    detectedLanguage,
    detectedIntent: intent,
    recommendedSection,
    sectionMismatch,
    missingFields,
    hasImageOnly,
    confidence,
    guidanceType,
    shouldSend,
    imageExtractedText,
    rawAiResponse: haiku ? { ...haiku } : undefined,
  };
}
