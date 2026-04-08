export { ANTI_SPAM_CONFIG } from './config';
export type { PostStatus } from './config';
export {
  normalizeText,
  countLinks,
  extractPhones,
  hashtagCount,
  capsRatio,
  duplicateHash,
} from './detect';
export {
  computeSpamScore,
  decideStatus,
} from './score';
export type { UserProfile, PostingStats, SpamAnalysis } from './score';

// Import functions for internal use in analyzeSpam
import {
  normalizeText,
  countLinks,
  extractPhones,
  hashtagCount,
  capsRatio,
  duplicateHash,
} from './detect';
import {
  computeSpamScore,
  decideStatus,
} from './score';
import type { UserProfile, PostingStats, SpamAnalysis } from './score';

// Helper function to analyze spam for a post
export function analyzeSpam(params: {
  text: string;
  user_created_at: string;
  phone_verified: boolean;
  average_rating: number;
  review_count: number;
  recent_posts: Array<{ created_at: string }>;
}): SpamAnalysis {
  const normalized = normalizeText(params.text);

  const userProfile: UserProfile = {
    created_at: params.user_created_at,
    phone_verified: params.phone_verified,
    average_rating: params.average_rating,
    review_count: params.review_count,
  };

  const postingStats: PostingStats = {
    recent_posts: params.recent_posts,
  };

  const score = computeSpamScore(
    params.text,
    normalized,
    userProfile,
    postingStats
  );

  const { status, rank_penalty } = decideStatus(score);

  return {
    spam_score: score,
    status,
    rank_penalty,
    duplicate_hash: duplicateHash(normalized),
    link_count: countLinks(params.text),
    phone_count: extractPhones(params.text).length,
    hashtag_count: hashtagCount(params.text),
    caps_ratio: capsRatio(params.text),
    moderation_reasons: [],
  };
}
