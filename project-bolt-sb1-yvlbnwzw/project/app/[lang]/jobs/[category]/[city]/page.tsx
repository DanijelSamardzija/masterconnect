import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Lang } from '@/lib/i18n-config';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/job-categories';
import { humanizeCity, unslugifyCity } from '@/lib/seo/slugify';
import { JobPostCard } from '@/components/job-post-card';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CITY_SLUG_LEN = 100;
const JOB_POST_TYPES = ['hiring_post', 'job_seeker_post', 'service_request'] as const;

const UI_STRINGS = {
  sr: {
    home: 'Početna', jobs: 'Poslovi', noResults: 'Nema oglasa u ovoj kategoriji i gradu.',
  },
  en: {
    home: 'Home', jobs: 'Jobs', noResults: 'No listings in this category and city.',
  },
  de: {
    home: 'Startseite', jobs: 'Jobs', noResults: 'Keine Einträge in dieser Kategorie und Stadt.',
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

export default async function JobCityPage({
  params,
}: {
  params: { lang: Lang; category: string; city: string };
}) {
  const { lang, category, city } = params;

  if (
    UUID_RE.test(category) ||
    !isValidCategory(category) ||
    city.length === 0 ||
    city.length > MAX_CITY_SLUG_LEN ||
    UUID_RE.test(city)
  ) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const cityLabel = humanizeCity(city);
  const citySearch = unslugifyCity(city);
  const ui = UI_STRINGS[lang];

  const supabase = createClient();

  const { data: postsData } = await supabase
    .from('posts')
    .select('id, job_title, text, post_type, city, experience_level, created_at, profiles:profiles!posts_user_id_fkey(name)')
    .in('post_type', JOB_POST_TYPES)
    .eq('category', slug)
    .ilike('city', `%${citySearch}%`)
    .order('created_at', { ascending: false })
    .limit(48);

  const posts = (postsData ?? []) as unknown as JobPost[];

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
          <li>
            <Link href={`/${lang}/jobs/${slug}`} className="hover:text-orange-500 transition-colors">
              {categoryLabel}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">
            {cityLabel}
          </li>
        </ol>
      </nav>

      {/* Heading */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {lang === 'sr'
          ? `${categoryLabel} — ${cityLabel}`
          : `${categoryLabel} in ${cityLabel}`}
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mb-8 max-w-2xl">
        {lang === 'sr'
          ? `Oglasi za posao u kategoriji ${categoryLabel} u gradu ${cityLabel}.`
          : lang === 'de'
          ? `Stellenangebote in ${categoryLabel} in ${cityLabel}.`
          : `Job listings in ${categoryLabel} in ${cityLabel}.`}
      </p>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">{ui.noResults}</p>
          <Link
            href={`/${lang}/jobs/${slug}`}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            ← {categoryLabel}
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
    </div>
  );
}
