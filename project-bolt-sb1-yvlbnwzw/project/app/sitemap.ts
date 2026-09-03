import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_SLUGS, isValidCategory } from '@/lib/seo/categories';
import { slugifyCity } from '@/lib/seo/slugify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = 'https://www.gigzone.app';
const LANGS = ['sr', 'en', 'de', 'es', 'fr'] as const;

// Minimum number of active listings required to include a city landing page
// in the sitemap. Prevents thin/empty pages from being indexed.
const MIN_LISTINGS_FOR_CITY_PAGE = 2;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/help`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/invest`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/o-platformi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Language-specific public pages
  const langRoutes: MetadataRoute.Sitemap = LANGS.flatMap((lang) => [
    { url: `${BASE}/${lang}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${BASE}/${lang}/jobs`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE}/${lang}/services`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE}/${lang}/invest`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
  ]);

  // City and category landing pages — fetch listings once, compute max dates and counts in one pass.
  const { data: listingsForCities } = await supabase
    .from('posts')
    .select('category, city, created_at')
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .not('city', 'is', null)
    .not('category', 'is', null)
    .limit(5000);

  // Group by category+citySlug in JS; ':::' separator is safe (neither field uses it).
  // Also track max(created_at) per category and per category+city for meaningful lastModified.
  const cityCounts = new Map<string, number>();
  const maxDateByCategory = new Map<string, Date>();
  const maxDateByCityKey = new Map<string, Date>();

  for (const listing of listingsForCities ?? []) {
    if (!listing.city?.trim() || !isValidCategory(listing.category)) continue;
    const citySlug = slugifyCity(listing.city.trim());
    if (!citySlug) continue;
    const key = `${listing.category}:::${citySlug}`;
    cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1);

    const listingDate = new Date(listing.created_at);
    const catDate = maxDateByCategory.get(listing.category);
    if (!catDate || listingDate > catDate) maxDateByCategory.set(listing.category, listingDate);
    const keyDate = maxDateByCityKey.get(key);
    if (!keyDate || listingDate > keyDate) maxDateByCityKey.set(key, listingDate);
  }

  // 14 categories × 3 languages = 42 static URLs.
  // lastModified: most recent listing in that category (falls back to now if no listings yet).
  const categoryLandingUrls: MetadataRoute.Sitemap = LANGS.flatMap((lang) =>
    CATEGORY_SLUGS.map((category) => ({
      url: `${BASE}/${lang}/services/${category}`,
      lastModified: maxDateByCategory.get(category) ?? new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  const cityLandingUrls: MetadataRoute.Sitemap = [...cityCounts.entries()]
    .filter(([, count]) => count >= MIN_LISTINGS_FOR_CITY_PAGE)
    .flatMap(([key]) => {
      const sepIdx = key.indexOf(':::');
      const category = key.slice(0, sepIdx);
      const citySlug = key.slice(sepIdx + 3);
      return LANGS.map((lang) => ({
        url: `${BASE}/${lang}/services/${category}/${citySlug}`,
        lastModified: maxDateByCityKey.get(key) ?? new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.75,
      }));
    });

  // Jobs category/city landing pages — same approach as services, but for job post types.
  const { data: jobPostsForCities } = await supabase
    .from('posts')
    .select('category, city, created_at')
    .in('post_type', ['hiring_post', 'job_seeker_post', 'service_request'])
    .not('city', 'is', null)
    .not('category', 'is', null)
    .limit(5000);

  const jobCityCounts = new Map<string, number>();
  const jobMaxDateByCategory = new Map<string, Date>();
  const jobMaxDateByCityKey = new Map<string, Date>();

  for (const post of jobPostsForCities ?? []) {
    if (!(post as any).city?.trim() || !isValidCategory((post as any).category)) continue;
    const citySlug = slugifyCity(((post as any).city as string).trim());
    if (!citySlug) continue;
    const key = `${(post as any).category}:::${citySlug}`;
    jobCityCounts.set(key, (jobCityCounts.get(key) ?? 0) + 1);

    const postDate = new Date((post as any).created_at);
    const catDate = jobMaxDateByCategory.get((post as any).category);
    if (!catDate || postDate > catDate) jobMaxDateByCategory.set((post as any).category, postDate);
    const keyDate = jobMaxDateByCityKey.get(key);
    if (!keyDate || postDate > keyDate) jobMaxDateByCityKey.set(key, postDate);
  }

  // 14 categories × 3 languages = 42 static jobs landing URLs.
  const jobCategoryLandingUrls: MetadataRoute.Sitemap = LANGS.flatMap((lang) =>
    CATEGORY_SLUGS.map((category) => ({
      url: `${BASE}/${lang}/jobs/${category}`,
      lastModified: jobMaxDateByCategory.get(category) ?? new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  const jobCityLandingUrls: MetadataRoute.Sitemap = [...jobCityCounts.entries()]
    .filter(([, count]) => count >= MIN_LISTINGS_FOR_CITY_PAGE)
    .flatMap(([key]) => {
      const sepIdx = key.indexOf(':::');
      const category = key.slice(0, sepIdx);
      const citySlug = key.slice(sepIdx + 3);
      return LANGS.map((lang) => ({
        url: `${BASE}/${lang}/jobs/${category}/${citySlug}`,
        lastModified: jobMaxDateByCityKey.get(key) ?? new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.75,
      }));
    });

  const [allPostsRes, servicesRes, jobsRes, profilesRes, portAuthorRes, postMediaRes] = await Promise.all([
    // All post types that have a /posts/[id] detail page.
    // post_media(id) embed deliberately removed — PostgREST join caused silent query failure.
    // Media lookup is done via a separate postMediaRes query below.
    // status null-safe: many posts have status=null (treated as 'published' by the feed function);
    // .neq('status','deleted') would exclude those, so we use .or() to include null-status rows.
    supabase
      .from('posts')
      .select('id, updated_at, post_type, text, spam_score, user_id')
      .in('post_type', ['social_post', 'hiring_post', 'job_seeker_post', 'service_request', 'portfolio_post'])
      .or('status.is.null,status.neq.deleted')
      .order('updated_at', { ascending: false })
      .limit(45000),
    // Service listings have their own /services/[id] detail page.
    // user_id is also used below to identify profiles with active services.
    supabase
      .from('posts')
      .select('id, updated_at, user_id')
      .eq('post_type', 'service_listing')
      .eq('is_active', true)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
      .limit(20000),
    // Jobs from the jobs table have their own /jobs/[id] detail page
    // jobs.status values: 'open' | 'closed' | 'completed' — include all statuses
    // jobs table has created_at but NOT updated_at
    supabase
      .from('jobs')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(20000),
    // All profiles with a public /profile/[id] page.
    // bio, review_count, is_premium, category used for quality filter below.
    // profiles table has created_at but NOT updated_at
    supabase
      .from('profiles')
      .select('id, created_at, bio, review_count, is_premium, category')
      .order('created_at', { ascending: false })
      .limit(10000),
    // Distinct authors of non-deleted portfolio posts — used to identify
    // profiles with portfolio content even if they have no bio or reviews.
    // Null-safe status filter (same reasoning as allPostsRes above).
    supabase
      .from('posts')
      .select('user_id')
      .eq('post_type', 'portfolio_post')
      .or('status.is.null,status.neq.deleted')
      .limit(50000),
    // Post IDs that have at least one media item — used for social_post quality filter
    // and qualityFeedAuthorIds. Queried separately to avoid PostgREST join fragility.
    supabase
      .from('post_media')
      .select('post_id')
      .limit(100000),
  ]);

  // Build a Set of post IDs that have at least one media item.
  const postsWithMediaIds = new Set((postMediaRes.data || []).map((r) => (r as any).post_id as string));

  // Each post gets 3 language-specific URLs with hreflang support.
  // The legacy /posts/${id} route is left functional but not sitemapped;
  // Google discovers it via inbound links if needed.
  const postUrls: MetadataRoute.Sitemap = (allPostsRes.data || [])
    .filter((p) => {
      if (p.post_type !== 'social_post') return true;
      const spamScore = ((p as any).spam_score as number) || 0;
      if (spamScore >= 0.5) return false;
      const textLen = ((p as any).text as string || '').length;
      const hasMedia = postsWithMediaIds.has(p.id);
      return !(textLen < 50 && !hasMedia);
    })
    .flatMap((p) =>
      LANGS.map((lang) => ({
        url: `${BASE}/${lang}/posts/${p.id}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: p.post_type === 'social_post' ? 0.5 : 0.7,
      }))
    );

  // Each service gets 3 language-specific URLs via the [lang]/services/[category] route (UUID case).
  const serviceUrls: MetadataRoute.Sitemap = (servicesRes.data || []).flatMap((s) =>
    LANGS.map((lang) => ({
      url: `${BASE}/${lang}/services/${s.id}`,
      lastModified: new Date(s.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  );

  const jobUrls: MetadataRoute.Sitemap = (jobsRes.data || []).map((j) => ({
    url: `${BASE}/jobs/${j.id}`,
    lastModified: new Date(j.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Build lookup Sets from existing query results — O(n) one-time cost, O(1) per profile lookup.
  // svcAuthorIds: reuses servicesRes (already fetched); no extra DB round-trip needed.
  // qualityFeedAuthorIds: reuses allPostsRes + postsWithMediaIds Set.
  //   Same quality rules as layout.tsx: hiring/job_seeker/service_request always quality;
  //   portfolio_post/social_post quality if spam_score < 0.5 AND (text ≥ 50 OR has media).
  const svcAuthorIds = new Set((servicesRes.data || []).map((s) => (s as any).user_id as string));
  const portAuthorIds = new Set((portAuthorRes.data || []).map((r) => (r as any).user_id as string));

  const qualityFeedAuthorIds = new Set<string>();
  for (const p of allPostsRes.data || []) {
    const pt = p.post_type;
    const uid = (p as any).user_id as string;
    if (!uid) continue;
    if (['hiring_post', 'job_seeker_post', 'service_request'].includes(pt)) {
      qualityFeedAuthorIds.add(uid);
      continue;
    }
    // portfolio_post / social_post — apply quality filter
    const spamScore = ((p as any).spam_score as number) || 0;
    if (spamScore >= 0.5) continue;
    const textLen = ((p as any).text as string || '').length;
    const hasMedia = postsWithMediaIds.has(p.id);
    if (textLen >= 50 || hasMedia) qualityFeedAuthorIds.add(uid);
  }

  // Quality filter — identical criteria to the noindex check in profile/[id]/layout.tsx:
  //   bio ≥ 20 chars | review_count > 0 | category or PRO set | active service
  //   | portfolio post | ≥1 quality Feed post
  // Profiles without lang-prefixed routes stay at 1 URL each (no /sr/ /en/ /de/ prefix).
  const profileUrls: MetadataRoute.Sitemap = (profilesRes.data || [])
    .filter((p) => {
      const hasBio          = ((p as any).bio as string | null)?.trim().length >= 20;
      const hasReviews      = ((p as any).review_count as number | null ?? 0) > 0;
      const hasPROCategory  = !!((p as any).category || (p as any).is_premium);
      const hasServices     = svcAuthorIds.has(p.id);
      const hasPortfolio    = portAuthorIds.has(p.id);
      const hasQualityFeed  = qualityFeedAuthorIds.has(p.id);
      return hasBio || hasReviews || hasPROCategory || hasServices || hasPortfolio || hasQualityFeed;
    })
    .map((p) => ({
      url: `${BASE}/profile/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  return [
    ...staticRoutes,
    ...langRoutes,
    ...categoryLandingUrls,
    ...cityLandingUrls,
    ...jobCategoryLandingUrls,
    ...jobCityLandingUrls,
    ...jobUrls,
    ...serviceUrls,
    ...postUrls,
    ...profileUrls,
  ];
}
