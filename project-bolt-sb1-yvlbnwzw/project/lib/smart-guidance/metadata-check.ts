import type { GuidanceLanguage, PostMetadata } from './types';

const IMAGE_ONLY_THRESHOLD = 30;

// Post types where missing city is a meaningful signal
export const LOCATION_SENSITIVE_TYPES = new Set([
  'service_listing',
  'hiring_post',
  'job_seeker_post',
  'service_request',
]);

// Post types we should never send guidance for
const SKIP_TYPES = new Set(['portfolio_post']);

export async function fetchPostMetadata(
  postId: string,
  supabase: any
): Promise<PostMetadata | null> {
  const [postResult, mediaResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, user_id, text, post_type, city, country, phone_count, status')
      .eq('id', postId)
      .maybeSingle(),
    supabase
      .from('post_media')
      .select('url, type')
      .eq('post_id', postId)
      .eq('type', 'image')
      .order('order', { ascending: true }),
  ]);

  const post = postResult.data;
  if (!post) return null;

  // Skip deleted/hidden posts
  if (post.status === 'removed' || post.status === 'spam') return null;

  // Skip post types that don't benefit from guidance
  if (SKIP_TYPES.has(post.post_type)) return null;

  const imageUrls = (mediaResult.data ?? []).map((m: { url: string }) => m.url);
  const text = post.text?.trim() ?? '';
  const textLength = text.length;
  const hasImages = imageUrls.length > 0;
  const isImageOnly = hasImages && textLength < IMAGE_ONLY_THRESHOLD;

  // Fetch preferred_language from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', post.user_id)
    .maybeSingle();

  const rawLang = (profile as { preferred_language?: string } | null)?.preferred_language?.toLowerCase();
  const validLangs: GuidanceLanguage[] = ['sr', 'en', 'de'];
  const profilePreferredLanguage: GuidanceLanguage | null =
    validLangs.includes(rawLang as GuidanceLanguage) ? (rawLang as GuidanceLanguage) : null;

  return {
    postId: post.id,
    userId: post.user_id,
    postType: post.post_type,
    text,
    city: post.city ?? null,
    country: post.country ?? null,
    phoneCount: post.phone_count ?? 0,
    hasImages,
    imageCount: imageUrls.length,
    imageUrls,
    isImageOnly,
    textLength,
    profilePreferredLanguage,
  };
}

export function isPostComplete(meta: PostMetadata): boolean {
  // A post is considered "complete" and needs no guidance when:
  // 1. It has meaningful text (> 80 chars)
  // 2. If it's a location-sensitive type, it has a city
  // 3. It's not image-only
  const hasGoodText = meta.textLength > 80;
  const hasCity = !LOCATION_SENSITIVE_TYPES.has(meta.postType) || !!meta.city;
  const notImageOnly = !meta.isImageOnly;

  return hasGoodText && hasCity && notImageOnly;
}
