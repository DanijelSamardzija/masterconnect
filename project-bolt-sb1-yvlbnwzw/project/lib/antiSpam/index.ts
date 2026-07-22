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
  const now = Date.now();
  const oneHourAgo = now - 3_600_000;
  const oneDayAgo = now - 86_400_000;

  const userProfile: UserProfile = {
    created_at: params.user_created_at,
    phone_verified: params.phone_verified,
    avg_rating: params.average_rating,
    review_count: params.review_count,
  };

  const postingStats: PostingStats = {
    posts_last_hour: params.recent_posts.filter(
      (p) => new Date(p.created_at).getTime() > oneHourAgo
    ).length,
    posts_last_24h: params.recent_posts.filter(
      (p) => new Date(p.created_at).getTime() > oneDayAgo
    ).length,
  };

  return computeSpamScore(params.text, userProfile, postingStats, false);
}
