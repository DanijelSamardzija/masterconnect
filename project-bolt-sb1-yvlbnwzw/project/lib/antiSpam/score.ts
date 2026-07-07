import { ANTI_SPAM_CONFIG, PostStatus } from './config';
import {
  normalizeText,
  countLinks,
  countPhones,
  hashtagCount,
  capsRatio,
  duplicateHash,
} from './detect';

export interface UserProfile {
  created_at: string;
  phone_verified?: boolean;
  avg_rating?: number;
  review_count?: number;
  bio?: string;
  city?: string;
  categories?: string[];
}

export interface PostingStats {
  posts_last_hour: number;
  posts_last_24h: number;
}

export interface SpamAnalysis {
  spam_score: number;
  status: PostStatus;
  rank_penalty: number;
  duplicate_hash: string;
  link_count: number;
  phone_count: number;
  hashtag_count: number;
  caps_ratio: number;
  warnings: string[];
  moderation_reasons: string[];
  features: {
    phone_penalty: number;
    link_penalty: number;
    combo_penalty: number;
    hashtag_penalty: number;
    caps_penalty: number;
    rapid_posting_penalty: number;
    duplicate_penalty: number;
    new_account_penalty: number;
    phone_verified_bonus: number;
    reputation_bonus: number;
    complete_profile_bonus: number;
  };
}

export function computeSpamScore(
  postText: string,
  user: UserProfile,
  postingStats: PostingStats,
  isDuplicate: boolean,
  postType?: string
): SpamAnalysis {
  const isBusinessListing = postType === 'service_listing' || postType === 'job_post';
  const normalized = normalizeText(postText);
  const link_count = countLinks(postText);
  const phone_count = countPhones(postText);
  const hashtag_count = hashtagCount(postText);
  const caps_ratio_value = capsRatio(postText);
  const duplicate_hash_value = duplicateHash(normalized);

  let score = 0;

  let phone_penalty = 0;
  if (phone_count > 0) {
    phone_penalty = phone_count * ANTI_SPAM_CONFIG.PENALTIES.PHONE_PER_ITEM;
  }
  score += phone_penalty;

  let link_penalty = 0;
  if (link_count > 0) {
    link_penalty = link_count * ANTI_SPAM_CONFIG.PENALTIES.LINK_PER_ITEM;
  }
  score += link_penalty;

  let combo_penalty = 0;
  if (link_count >= ANTI_SPAM_CONFIG.THRESHOLDS.COMBO_SPAM_LINKS &&
      phone_count >= ANTI_SPAM_CONFIG.THRESHOLDS.COMBO_SPAM_PHONES) {
    combo_penalty = ANTI_SPAM_CONFIG.PENALTIES.COMBO_SPAM;
  }
  score += combo_penalty;

  let hashtag_penalty = 0;
  if (hashtag_count > 0) {
    hashtag_penalty = hashtag_count * ANTI_SPAM_CONFIG.PENALTIES.HASHTAG_PER_ITEM;
  }
  score += hashtag_penalty;

  let caps_penalty = 0;
  if (caps_ratio_value > ANTI_SPAM_CONFIG.THRESHOLDS.CAPS_RATIO) {
    caps_penalty = ANTI_SPAM_CONFIG.PENALTIES.EXCESSIVE_CAPS;
  }
  score += caps_penalty;

  let rapid_posting_penalty = 0;
  if (postingStats.posts_last_hour > ANTI_SPAM_CONFIG.THRESHOLDS.RAPID_POSTING_1H ||
      postingStats.posts_last_24h > ANTI_SPAM_CONFIG.THRESHOLDS.RAPID_POSTING_24H) {
    rapid_posting_penalty = ANTI_SPAM_CONFIG.PENALTIES.RAPID_POSTING;
  }
  score += rapid_posting_penalty;

  let duplicate_penalty = 0;
  if (isDuplicate) {
    duplicate_penalty = ANTI_SPAM_CONFIG.PENALTIES.DUPLICATE_CONTENT;
  }
  score += duplicate_penalty;

  let new_account_penalty = 0;
  const accountAge = Date.now() - new Date(user.created_at).getTime();
  const daysOld = accountAge / (1000 * 60 * 60 * 24);
  // Business listings: new firms legitimately create accounts to post services/jobs
  if (!isBusinessListing && daysOld < ANTI_SPAM_CONFIG.THRESHOLDS.NEW_ACCOUNT_DAYS) {
    new_account_penalty = ANTI_SPAM_CONFIG.PENALTIES.NEW_ACCOUNT;
  }
  score += new_account_penalty;

  let phone_verified_bonus = 0;
  if (user.phone_verified) {
    phone_verified_bonus = ANTI_SPAM_CONFIG.BONUSES.PHONE_VERIFIED;
  }
  score += phone_verified_bonus;

  let reputation_bonus = 0;
  if (user.review_count && user.avg_rating &&
      user.review_count >= ANTI_SPAM_CONFIG.THRESHOLDS.GOOD_REPUTATION_MIN_REVIEWS &&
      user.avg_rating >= ANTI_SPAM_CONFIG.THRESHOLDS.GOOD_REPUTATION_RATING) {
    reputation_bonus = ANTI_SPAM_CONFIG.BONUSES.GOOD_REPUTATION;
  }
  score += reputation_bonus;

  let complete_profile_bonus = 0;
  if (user.bio && user.city && user.categories && user.categories.length > 0) {
    complete_profile_bonus = ANTI_SPAM_CONFIG.BONUSES.COMPLETE_PROFILE;
  }
  score += complete_profile_bonus;

  if (caps_ratio_value > ANTI_SPAM_CONFIG.THRESHOLDS.CAPS_RATIO && score > 0) {
    score = Math.floor(score * ANTI_SPAM_CONFIG.PENALTIES.CAPS_MULTIPLIER);
  }

  if (link_count >= ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_HIDDEN_LINKS) {
    score = Math.max(score, 80);
  } else if (link_count >= ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_LIMITED_LINKS) {
    score = Math.max(score, 60);
  }

  // Business listings may legitimately list multiple contact numbers
  const autoLimitedPhonesThreshold = isBusinessListing
    ? ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_LIMITED_PHONES + 2
    : ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_LIMITED_PHONES;
  const autoHiddenPhonesThreshold = isBusinessListing
    ? ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_HIDDEN_PHONES + 2
    : ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_HIDDEN_PHONES;

  if (phone_count >= autoHiddenPhonesThreshold) {
    score = Math.max(score, 80);
  } else if (phone_count >= autoLimitedPhonesThreshold) {
    score = Math.max(score, 60);
  }

  score = Math.max(0, Math.min(100, score));

  const { status, rank_penalty } = decideStatus(score);

  const warnings: string[] = [];
  if (link_count > ANTI_SPAM_CONFIG.UI_WARNINGS.WARN_LINKS_OVER) {
    warnings.push('TOO_MANY_LINKS_WARNING');
  }
  if (phone_count > ANTI_SPAM_CONFIG.UI_WARNINGS.WARN_PHONES_OVER) {
    warnings.push('TOO_MANY_PHONES_WARNING');
  }

  const moderation_reasons: string[] = [];

  if (link_count >= ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_LIMITED_LINKS) {
    moderation_reasons.push('too_many_links');
  }

  if (phone_count >= ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_LIMITED_PHONES) {
    moderation_reasons.push('too_many_phones');
  }

  if (caps_ratio_value > ANTI_SPAM_CONFIG.THRESHOLDS.CAPS_RATIO && caps_penalty > 0) {
    moderation_reasons.push('excessive_caps');
  }

  if (isDuplicate) {
    moderation_reasons.push('duplicate_content');
  }

  if (rapid_posting_penalty > 0) {
    moderation_reasons.push('rapid_posting');
  }

  if (combo_penalty > 0) {
    moderation_reasons.push('spam_detected');
  }

  return {
    spam_score: score,
    status,
    rank_penalty,
    duplicate_hash: duplicate_hash_value,
    link_count,
    phone_count,
    hashtag_count,
    caps_ratio: caps_ratio_value,
    warnings,
    moderation_reasons,
    features: {
      phone_penalty,
      link_penalty,
      combo_penalty,
      hashtag_penalty,
      caps_penalty,
      rapid_posting_penalty,
      duplicate_penalty,
      new_account_penalty,
      phone_verified_bonus,
      reputation_bonus,
      complete_profile_bonus,
    },
  };
}

export function decideStatus(score: number): { status: PostStatus; rank_penalty: number } {
  const { STATUS_RANGES } = ANTI_SPAM_CONFIG;

  if (score >= STATUS_RANGES.SHADOW_HIDDEN.min && score <= STATUS_RANGES.SHADOW_HIDDEN.max) {
    return { status: STATUS_RANGES.SHADOW_HIDDEN.status, rank_penalty: STATUS_RANGES.SHADOW_HIDDEN.rank_penalty };
  }

  if (score >= STATUS_RANGES.SHADOW_LIMITED.min && score <= STATUS_RANGES.SHADOW_LIMITED.max) {
    return { status: STATUS_RANGES.SHADOW_LIMITED.status, rank_penalty: STATUS_RANGES.SHADOW_LIMITED.rank_penalty };
  }

  if (score >= STATUS_RANGES.PUBLISHED_LOW_RANK.min && score <= STATUS_RANGES.PUBLISHED_LOW_RANK.max) {
    return { status: STATUS_RANGES.PUBLISHED_LOW_RANK.status, rank_penalty: STATUS_RANGES.PUBLISHED_LOW_RANK.rank_penalty };
  }

  return { status: STATUS_RANGES.PUBLISHED_FULL_RANK.status, rank_penalty: STATUS_RANGES.PUBLISHED_FULL_RANK.rank_penalty };
}
