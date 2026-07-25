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
  // ── Core — maps to profiles table ───────────────────────────
  id: string;
  name: string;
  bio: string;
  isPremium: boolean;          // profiles.is_premium
  rating: number;              // profiles.average_rating
  reviewCount: number;         // profiles.review_count
  verified: boolean;           // profiles.verified (to be added in migration)
  joinedAt: string;            // profiles.created_at → ISO string
  lastActive: string | null;   // profiles.last_active_at → ISO string

  // ── Media URLs — maps to profiles table ─────────────────────
  coverUrl: string | null;     // profiles.cover_url (column exists)
  avatarUrl: string | null;    // profiles.avatar_url

  // ── Adult-specific — maps to profiles (adult_ prefix cols) ──
  handle: string;              // profiles.adult_handle
  category: CreatorCategory;   // profiles.adult_category
  country: string;             // profiles.country (ISO code: 'rs', 'de'…)
  city: string;                // profiles.city
  languages: string[];         // profiles.adult_languages (text[])
  responseTime: string | null; // profiles.adult_response_time
  tags: string[];              // profiles.adult_tags (text[])
  supportPrice: number;        // profiles.adult_support_price (credits)

  // ── Aggregates — derived from follows / counts ───────────────
  followers: number;
  following: number;
  isOnline: boolean;           // derived from last_seen presence

  // ── Content counts — from media table or cached cols ─────────
  galleryCount: number;
  videoCount: number;

  // ── Computed by repository mapper (never stored in DB) ───────
  countryFlag: string;          // emoji derived from country code
  avatarInitials: string;       // derived from name
  coverStyle: { background: string };   // gradient fallback when coverUrl is null
  avatarStyle: { background: string };  // gradient fallback when avatarUrl is null
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

// ── Adult Services ────────────────────────────────────────────────────────────

export type ServiceCategory =
  | 'Photo'
  | 'Video'
  | 'Live Session'
  | 'Chat'
  | 'Custom'
  | 'Event';

export type ServicePriceType =
  | 'fixed'         // tačna cijena
  | 'starting_from' // cijena "od X"
  | 'hourly'        // po satu
  | 'negotiable';   // dogovor

export type ServiceDeliveryType =
  | 'instant'    // odmah (live session, chat)
  | 'scheduled'  // zakazano (shoot, event)
  | 'delivered'; // dostavlja se (foto set, video)

export type AdultService = {
  id: string;
  creatorId: string;             // → adult_services.creator_id
  title: string;
  description: string;
  category: ServiceCategory;
  priceCredits: number;          // → adult_services.price_credits
  priceType: ServicePriceType;   // → adult_services.price_type
  deliveryTime: string | null;   // → adult_services.delivery_time
  deliveryType: ServiceDeliveryType; // → adult_services.delivery_type
  isFeatured: boolean;           // → adult_services.is_featured
  isActive: boolean;             // → adult_services.is_active
  sortOrder: number;             // → adult_services.sort_order
};
