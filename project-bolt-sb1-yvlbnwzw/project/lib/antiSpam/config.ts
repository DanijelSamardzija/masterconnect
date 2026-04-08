export const ANTI_SPAM_CONFIG = {
  CONTACT_THRESHOLDS: {
    ALLOWED_PHONES: 1,
    ALLOWED_LINKS: 1,
  },

  PENALTIES: {
    PHONE_PER_ITEM: 10,
    LINK_PER_ITEM: 5,
    HASHTAG_PER_ITEM: 2,
    COMBO_SPAM: 15,
    EXCESSIVE_CAPS: 10,
    CAPS_MULTIPLIER: 1.5,
    RAPID_POSTING: 20,
    DUPLICATE_CONTENT: 25,
    NEW_ACCOUNT: 10,
  },

  BONUSES: {
    PHONE_VERIFIED: -10,
    GOOD_REPUTATION: -10,
    COMPLETE_PROFILE: -5,
  },

  THRESHOLDS: {
    CAPS_RATIO: 0.35,
    MIN_LETTERS_FOR_CAPS: 30,
    RAPID_POSTING_1H: 10,
    RAPID_POSTING_24H: 30,
    NEW_ACCOUNT_DAYS: 7,
    GOOD_REPUTATION_RATING: 4.5,
    GOOD_REPUTATION_MIN_REVIEWS: 5,
    COMBO_SPAM_PHONES: 3,
    COMBO_SPAM_LINKS: 3,
    AUTO_SHADOW_LIMITED_LINKS: 6,
    AUTO_SHADOW_HIDDEN_LINKS: 9,
    AUTO_SHADOW_LIMITED_PHONES: 3,
    AUTO_SHADOW_HIDDEN_PHONES: 5,
  },

  UI_WARNINGS: {
    WARN_LINKS_OVER: 3,
    WARN_PHONES_OVER: 1,
  },

  STATUS_RANGES: {
    PUBLISHED_FULL_RANK: { min: 0, max: 49, status: 'published' as const, rank_penalty: 1.0 },
    PUBLISHED_LOW_RANK: { min: 50, max: 59, status: 'published' as const, rank_penalty: 0.4 },
    SHADOW_LIMITED: { min: 60, max: 79, status: 'shadow_limited' as const, rank_penalty: 0.2 },
    SHADOW_HIDDEN: { min: 80, max: 100, status: 'shadow_hidden' as const, rank_penalty: 0.1 },
  },

  PHONE_VALIDATION: {
    MIN_DIGITS: 9,
    MAX_DIGITS: 15,
  },
};

export type PostStatus = 'published' | 'needs_review' | 'shadow_limited' | 'shadow_hidden';
