import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n-config';
import { BASE_URL } from '@/lib/i18n-config';
import {
  isValidCategory,
  CATEGORY_SEO,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/seo/categories';
import { ProfessionalCard } from '@/components/professional-card';

export const revalidate = 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UI_STRINGS = {
  sr: { home: 'Početna', services: 'Usluge', noResults: 'Nema usluga u ovoj kategoriji.' },
  en: { home: 'Home', services: 'Services', noResults: 'No services in this category.' },
  de: { home: 'Startseite', services: 'Dienstleistungen', noResults: 'Keine Dienstleistungen in dieser Kategorie.' },
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select(
      'id, user_id, job_title, text, category, city, country, price_type, price_value, currency, created_at, profiles(name, avatar_url, account_type, average_rating, review_count, last_seen, is_premium), post_media(id, type, url, order)'
    )
    .eq('post_type', 'service_listing')
    .eq('category', slug)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(48);

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
    </div>
  );
}
