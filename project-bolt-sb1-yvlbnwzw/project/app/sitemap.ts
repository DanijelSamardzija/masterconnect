import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.gigzone.app';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/services`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/jobs`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/help`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];

  const [servicesRes, jobsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, updated_at')
      .eq('post_type', 'service_listing')
      .eq('status', 'published')
      .limit(1000),
    supabase
      .from('posts')
      .select('id, updated_at')
      .in('post_type', ['hiring_post', 'job_seeker_post'])
      .eq('status', 'published')
      .limit(1000),
  ]);

  const serviceUrls: MetadataRoute.Sitemap = (servicesRes.data || []).map((s) => ({
    url: `${base}/services/${s.id}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const jobUrls: MetadataRoute.Sitemap = (jobsRes.data || []).map((j) => ({
    url: `${base}/jobs/${j.id}`,
    lastModified: new Date(j.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...serviceUrls, ...jobUrls];
}
