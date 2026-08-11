export type GuidanceLanguage = 'sr' | 'en' | 'de';

export type GuidanceIntent =
  | 'SEEKING_JOB'
  | 'HIRING'
  | 'OFFERING_SERVICE'
  | 'SEEKING_SERVICE'
  | 'PORTFOLIO'
  | 'SOCIAL';

export type GuidancePostType =
  | 'social_post'
  | 'portfolio_post'
  | 'service_listing'
  | 'hiring_post'
  | 'job_seeker_post'
  | 'service_request';

export type GuidanceType =
  | 'wrong_section'
  | 'missing_content'
  | 'image_only'
  | 'wrong_section_and_missing'
  | 'service_to_feed'
  | 'no_action';

export interface PostMetadata {
  postId: string;
  userId: string;
  postType: string;
  text: string;
  city: string | null;
  country: string | null;
  phoneCount: number;
  hasImages: boolean;
  imageCount: number;
  imageUrls: string[];
  isImageOnly: boolean;   // hasImages AND text.trim().length < 30
  textLength: number;
  profilePreferredLanguage: GuidanceLanguage | null;
}

export interface HaikuClassification {
  detectedLanguage: GuidanceLanguage;
  intent: GuidanceIntent;
  missingFields: string[];   // 'city' | 'contact' | 'description'
  confidence: number;        // 0.0–1.0
}

export interface ClassificationResult {
  detectedLanguage: GuidanceLanguage;
  detectedIntent: GuidanceIntent;
  recommendedSection: GuidancePostType | null;
  sectionMismatch: boolean;
  missingFields: string[];
  hasImageOnly: boolean;
  confidence: number;
  guidanceType: GuidanceType;
  shouldSend: boolean;
  imageExtractedText?: string;
  rawAiResponse?: object;
}

export interface GuidanceNotification {
  title: string;
  body: string;
  ctaUrl: string;
}
