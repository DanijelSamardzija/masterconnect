import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_SLUGS, isValidCategory } from '@/lib/seo/categories';
import { slugifyCity } from '@/lib/seo/slugify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = 'https://www.gigzone.app';
const LANGS = ['sr', 'en', 'de'] as const;

// Minimum number of active listings required to include a city landing page
// in the sitemap. Prevents thin/empty pages from being indexed.
const MIN_LISTINGS_FOR_CITY_PAGE = 2;

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
    { url: `${BASE}/${lang}/jobs`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE}/${lang}/services`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE}/${lang}/invest`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
  ]);

  // Category landing pages — all 14 categories × 3 languages = 42 static URLs
  const categoryLandingUrls: MetadataRoute.Sitemap = LANGS.flatMap((lang) =>
    CATEGORY_SLUGS.map((category) => ({
      url: `${BASE}/${lang}/services/${category}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  // City landing pages — only category+city combinations with MIN_LISTINGS_FOR_CITY_PAGE
  // active listings are included to prevent thin content from being indexed.
  const { data: listingsForCities } = await supabase
    .from('posts')
    .select('category, city')
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .not('city', 'is', null)
    .not('category', 'is', null);

  // Group by category+citySlug in JS; ':::' separator is safe (neither field uses it)
  const cityCounts = new Map<string, number>();
  for (const listing of listingsForCities ?? []) {
    if (!listing.city?.trim() || !isValidCategory(listing.category)) continue;
    const citySlug = slugifyCity(listing.city.trim());
    if (!citySlug) continue;
    const key = `${listing.category}:::${citySlug}`;
    cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1);
  }

  const cityLandingUrls: MetadataRoute.Sitemap = [...cityCounts.entries()]
    .filter(([, count]) => count >= MIN_LISTINGS_FOR_CITY_PAGE)
    .flatMap(([key]) => {
      const sepIdx = key.indexOf(':::');
      const category = key.slice(0, sepIdx);
      const citySlug = key.slice(sepIdx + 3);
      return LANGS.map((lang) => ({
        url: `${BASE}/${lang}/services/${category}/${citySlug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.75,
      }));
    });

  const [allPostsRes, servicesRes, jobsRes, profilesRes] = await Promise.all([
    // All post types that have a /posts/[id] detail page
    supabase
      .from('posts')
      .select('id, updated_at, post_type')
      .in('post_type', ['social_post', 'hiring_post', 'job_seeker_post', 'service_request', 'portfolio_post'])
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
      .limit(2000),
    // Service listings have their own /services/[id] detail page
    supabase
      .from('posts')
      .select('id, updated_at')
      .eq('post_type', 'service_listing')
      .neq('status', 'deleted')
      .limit(1000),
    // Jobs from the jobs table have their own /jobs/[id] detail page
    // jobs.status values: 'open' | 'closed' | 'completed' — include all statuses
    // jobs table has created_at but NOT updated_at
    supabase
      .from('jobs')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    // All profiles with a public /profile/[id] page
    // profiles table has created_at but NOT updated_at
    supabase
      .from('profiles')
      .select('id, created_at')
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);

  const postUrls: MetadataRoute.Sitemap = (allPostsRes.data || []).map((p) => ({
    url: `${BASE}/posts/${p.id}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: 'weekly' as const,
    priority: p.post_type === 'social_post' ? 0.6 : 0.7,
  }));

  const serviceUrls: MetadataRoute.Sitemap = (servicesRes.data || []).map((s) => ({
    url: `${BASE}/services/${s.id}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const jobUrls: MetadataRoute.Sitemap = (jobsRes.data || []).map((j) => ({
    url: `${BASE}/jobs/${j.id}`,
    lastModified: new Date(j.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const profileUrls: MetadataRoute.Sitemap = (profilesRes.data || []).map((p) => ({
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
    ...jobUrls,
    ...serviceUrls,
    ...postUrls,
    ...profileUrls,
  ];
}
