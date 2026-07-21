import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = 'https://www.gigzone.app';
const LANGS = ['sr', 'en', 'de'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
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

  return [...staticRoutes, ...langRoutes, ...jobUrls, ...serviceUrls, ...postUrls, ...profileUrls];
}
