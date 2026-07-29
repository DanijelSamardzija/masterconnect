import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Lang } from '@/lib/i18n-config';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/categories';
import { humanizeCity, unslugifyCity } from '@/lib/seo/slugify';
import { ProfessionalCard } from '@/components/professional-card';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Filter shape for listing queries.
// To add country later: add `country?: string` here and one `.ilike()` in buildListingQuery.
type ListingFilter = {
  category: CategorySlug;
  city: string; // city slug, e.g. "banja-luka"
  // country?: string; // country slug — extend here when /{category}/{country}/{city} is needed
};

// Centralised query builder — all DB filter logic lives here.
// Adding a new filter dimension (country, price range, etc.) means one change in this function.
async function buildListingQuery(supabase: SupabaseClient, filter: ListingFilter) {
  const citySearch = unslugifyCity(filter.city); // "banja-luka" → "banja luka"

  let query = supabase
    .from('posts')
    .select(
      'id, user_id, job_title, text, category, city, country, price_type, price_value, currency, created_at, profiles(name, avatar_url, account_type, average_rating, review_count, last_seen, is_premium), post_media(id, type, url, order)'
    )
    .eq('post_type', 'service_listing')
    .eq('category', filter.category)
    .eq('is_active', true)
    .ilike('city', `%${citySearch}%`);

  // When country filtering is added:
  // if (filter.country) {
  //   const countrySearch = unslugifyCountry(filter.country);
  //   query = query.ilike('country', `%${countrySearch}%`);
  // }

  return query.order('created_at', { ascending: false }).limit(48);
}

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

const UI_STRINGS = {
  sr: {
    home: 'Početna',
    services: 'Usluge',
    noResults: 'Nema usluga u ovoj kategoriji i gradu.',
    backToCategory: 'Pogledaj sve',
  },
  en: {
    home: 'Home',
    services: 'Services',
    noResults: 'No services in this category and city.',
    backToCategory: 'View all',
  },
  de: {
    home: 'Startseite',
    services: 'Dienstleistungen',
    noResults: 'Keine Dienstleistungen in dieser Kategorie und Stadt.',
    backToCategory: 'Alle anzeigen',
  },
} as const;

export default async function CityLandingPage({
  params,
}: {
  params: { lang: Lang; category: string; city: string };
}) {
  const { lang, category, city } = params;

  // Guards — layout also validates, page must be self-consistent
  if (!isValidCategory(category) || !city || UUID_RE.test(city)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const cityLabel = humanizeCity(city);
  const ui = UI_STRINGS[lang];

  const supabase = createClient();
  const { data } = await buildListingQuery(supabase, { category: slug, city });
  const listings = (data ?? []) as unknown as Listing[];

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
          <li>
            <Link
              href={`/services/${slug}`}
              className="hover:text-orange-500 transition-colors"
            >
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
        {categoryLabel} — {cityLabel}
      </h1>

      {listings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">{ui.noResults}</p>
          <Link
            href={`/services/${slug}`}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            ← {categoryLabel} ({ui.backToCategory})
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
          {listings.map((listing) => (
            <ProfessionalCard key={listing.id} listing={listing as any} />
          ))}
        </div>
      )}
    </div>
  );
}
