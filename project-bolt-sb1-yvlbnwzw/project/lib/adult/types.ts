export type CreatorCategory =
  | 'Creators'
  | 'Models'
  | 'Entertainment'
  | 'Night Clubs'
  | 'Webcam'
  | 'Photography'
  | 'Studios'
  | 'Agencies';

export type Creator = {
  id: string;
  name: string;
  handle: string;
  category: CreatorCategory;
  country: string;
  countryFlag: string;
  city: string;
  verified: boolean;
  isPremium: boolean;
  isOnline: boolean;
  followers: number;
  following: number;
  rating: number;
  reviewCount: number;
  supportPrice: number;
  bio: string;
  tags: string[];
  coverStyle: { background: string };
  avatarInitials: string;
  avatarStyle: { background: string };
  galleryCount: number;
  videoCount: number;
};

export type CreatorFilters = {
  category?: CreatorCategory | 'All';
  country?: string;
  city?: string;
  minRating?: number;
  verifiedOnly?: boolean;
  premiumOnly?: boolean;
  onlineOnly?: boolean;
  search?: string;
  sort?: 'trending' | 'newest' | 'top';
};

export const ALL_CATEGORIES = [
  'All',
  'Creators',
  'Models',
  'Entertainment',
  'Night Clubs',
  'Webcam',
  'Photography',
  'Studios',
  'Agencies',
] as const;

export type AnyCategory = typeof ALL_CATEGORIES[number];

export { formatFollowers } from '@/lib/utils/number';
