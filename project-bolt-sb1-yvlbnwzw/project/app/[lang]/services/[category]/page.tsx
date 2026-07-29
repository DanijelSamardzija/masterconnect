import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Lang } from '@/lib/i18n-config';
import {
  isValidCategory,
  CATEGORY_SEO,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/seo/categories';
import { slugifyCity, humanizeCity } from '@/lib/seo/slugify';
import { ProfessionalCard } from '@/components/professional-card';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_CITY_LINKS = 2;

const UI_STRINGS = {
  sr: { home: 'Početna', services: 'Usluge', noResults: 'Nema usluga u ovoj kategoriji.', topCities: 'Top gradovi' },
  en: { home: 'Home', services: 'Services', noResults: 'No services in this category.', topCities: 'Top cities' },
  de: { home: 'Startseite', services: 'Dienstleistungen', noResults: 'Keine Dienstleistungen in dieser Kategorie.', topCities: 'Top-Städte' },
} as const;

type Listing = {
  id: string;
  user_id: string;
  job_title: string;
  text: string;
  category: string;
  city: string;
  country: string | null;
  price_type: string | null;
  price_value: number | null;
  currency: string | null;
  created_at: string;
  profiles: {
    name: string;
    avatar_url: string | null;
    account_type: string | null;
    average_rating: number | null;
    review_count: number | null;
    last_seen: string | null;
    is_premium: boolean | null;
  };
  post_media: Array<{ id: string; type: string; url: string; order: number }>;
};

export default async function CategoryLandingPage({
  params,
}: {
  params: { lang: Lang; category: string };
}) {
  const { lang, category } = params;

  // Layout handles the redirect/notFound, but page must also be self-consistent
  if (UUID_RE.test(category) || !isValidCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const meta = CATEGORY_SEO[slug][lang];
  const ui = UI_STRINGS[lang];

  const supabase = createClient();

  const [listingsResult, citiesResult] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, user_id, job_title, text, category, city, country, price_type, price_value, currency, created_at, profiles(name, avatar_url, account_type, average_rating, review_count, last_seen, is_premium), post_media(id, type, url, order)'
      )
      .eq('post_type', 'service_listing')
      .eq('category', slug)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(48),
    supabase
      .from('posts')
      .select('city')
      .eq('post_type', 'service_listing')
      .eq('category', slug)
      .eq('is_active', true)
      .not('city', 'is', null),
  ]);

  const listings = (listingsResult.data ?? []) as unknown as Listing[];

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
            <Link href="/" className="hover:text-orange-500 transition-colors">
              {ui.home}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/services" className="hover:text-orange-500 transition-colors">
              {ui.services}
            </Link>
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

      {listings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">{ui.noResults}</p>
          <Link
            href="/services"
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            ← {ui.services}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ProfessionalCard key={listing.id} listing={listing as any} />
          ))}
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
                  href={`/${lang}/services/${slug}/${citySlug}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400 transition-colors"
                >
                  {humanizeCity(citySlug)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
