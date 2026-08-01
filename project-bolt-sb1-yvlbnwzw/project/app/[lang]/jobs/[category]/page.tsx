import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Lang } from '@/lib/i18n-config';
import {
  JOB_CATEGORY_SEO,
  isValidCategory,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/seo/job-categories';
import { slugifyCity, humanizeCity } from '@/lib/seo/slugify';
import { JobPostCard } from '@/components/job-post-card';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_POST_TYPES = ['hiring_post', 'job_seeker_post', 'service_request'] as const;
const MIN_CITY_LINKS = 2;

const UI_STRINGS = {
  sr: {
    home: 'Početna', jobs: 'Poslovi', noResults: 'Nema oglasa u ovoj kategoriji.',
    topCities: 'Top gradovi', allJobs: 'Sve kategorije',
    crossLinkText: 'Tražiš stručnjaka za ovu oblast?', crossLinkLabel: 'Pogledaj usluge',
  },
  en: {
    home: 'Home', jobs: 'Jobs', noResults: 'No listings in this category.',
    topCities: 'Top cities', allJobs: 'All categories',
    crossLinkText: 'Looking for a professional?', crossLinkLabel: 'Browse services',
  },
  de: {
    home: 'Startseite', jobs: 'Jobs', noResults: 'Keine Einträge in dieser Kategorie.',
    topCities: 'Top-Städte', allJobs: 'Alle Kategorien',
    crossLinkText: 'Suchen Sie einen Fachmann?', crossLinkLabel: 'Dienstleistungen ansehen',
  },
} as const;

type JobPost = {
  id: string;
  job_title: string | null;
  text: string | null;
  post_type: string;
  city: string | null;
  experience_level: string | null;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

export default async function JobCategoryPage({
  params,
}: {
  params: { lang: Lang; category: string };
}) {
  const { lang, category } = params;

  if (UUID_RE.test(category) || !isValidCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const meta = JOB_CATEGORY_SEO[slug][lang];
  const ui = UI_STRINGS[lang];

  const supabase = createClient();

  const [postsResult, citiesResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, job_title, text, post_type, city, experience_level, created_at, profiles:profiles!posts_user_id_fkey(name)')
      .in('post_type', JOB_POST_TYPES)
      .eq('category', slug)
      .order('created_at', { ascending: false })
      .limit(48),
    supabase
      .from('posts')
      .select('city')
      .in('post_type', JOB_POST_TYPES)
      .eq('category', slug)
      .not('city', 'is', null),
  ]);

  const posts = (postsResult.data ?? []) as unknown as JobPost[];

  const cityCounts = new Map<string, number>();
  for (const row of citiesResult.data ?? []) {
    if (!row.city?.trim()) continue;
    const citySlug = slugifyCity(row.city.trim());
    if (!citySlug) continue;
    cityCounts.set(citySlug, (cityCounts.get(citySlug) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .filter(([, count]) => count >= MIN_CITY_LINKS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([citySlug]) => citySlug);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          <li>
            <Link href="/" className="hover:text-orange-500 transition-colors">{ui.home}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href={`/${lang}/jobs`} className="hover:text-orange-500 transition-colors">{ui.jobs}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">
            {categoryLabel}
          </li>
        </ol>
      </nav>

      {/* Heading */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {categoryLabel}
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mb-8 max-w-2xl">
        {meta.description}
      </p>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">{ui.noResults}</p>
          <Link
            href={`/${lang}/jobs`}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            ← {ui.jobs}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
            const authorName = (profileData as any)?.name ?? 'GigZone korisnik';
            return (
              <JobPostCard
                key={post.id}
                id={post.id}
                job_title={post.job_title}
                text={post.text}
                post_type={post.post_type}
                city={post.city}
                experience_level={post.experience_level}
                created_at={post.created_at}
                author_name={authorName}
                lang={lang}
              />
            );
          })}
        </div>
      )}

      {topCities.length > 0 && (
        <section className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {ui.topCities}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {topCities.map((citySlug) => (
              <li key={citySlug}>
                <Link
                  href={`/${lang}/jobs/${slug}/${citySlug}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400 transition-colors"
                >
                  {humanizeCity(citySlug)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        {ui.crossLinkText}{' '}
        <Link
          href={`/${lang}/services/${slug}`}
          className="font-medium text-orange-600 hover:underline"
        >
          {ui.crossLinkLabel} — {categoryLabel}
        </Link>
        .
      </p>
    </div>
  );
}
