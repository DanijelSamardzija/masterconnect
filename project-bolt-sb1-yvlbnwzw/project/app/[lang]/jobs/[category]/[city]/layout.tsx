import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BASE_URL, hreflang, type Lang } from '@/lib/i18n-config';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/job-categories';
import { humanizeCity } from '@/lib/seo/slugify';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CITY_SLUG_LEN = 100;

const TITLE_TEMPLATE = {
  sr: (cat: string, city: string) => `Posao — ${cat} u ${city} | GigZone`,
  en: (cat: string, city: string) => `${cat} Jobs in ${city} | GigZone`,
  de: (cat: string, city: string) => `${cat} Jobs in ${city} | GigZone`,
  es: (cat: string, city: string) => `Empleos de ${cat} en ${city} | GigZone`,
  fr: (cat: string, city: string) => `Emplois ${cat} à ${city} | GigZone`,
} as const;

const DESC_TEMPLATE = {
  sr: (cat: string, city: string) =>
    `Oglasi za posao u kategoriji ${cat} u ${city}. Pronađite posao ili objavite oglas za radnike — GigZone.`,
  en: (cat: string, city: string) =>
    `Job listings in ${cat} in ${city}. Find work or post a job for workers — GigZone.`,
  de: (cat: string, city: string) =>
    `Stellenangebote in ${cat} in ${city}. Arbeit finden oder Mitarbeiter einstellen — GigZone.`,
  es: (cat: string, city: string) =>
    `Ofertas de empleo en ${cat} en ${city}. Encuentra trabajo o publica un anuncio — GigZone.`,
  fr: (cat: string, city: string) =>
    `Offres d'emploi en ${cat} à ${city}. Trouvez du travail ou publiez une offre — GigZone.`,
} as const;

type Params = { lang: Lang; category: string; city: string };

function isCitySlugValid(city: string): boolean {
  return city.length > 0 && city.length <= MAX_CITY_SLUG_LEN && !UUID_RE.test(city);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, category, city } = params;

  if (!isValidCategory(category) || !isCitySlugValid(city)) return {};

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const cityLabel = humanizeCity(city);
  const canonical = `${BASE_URL}/${lang}/jobs/${slug}/${city}`;

  const title = TITLE_TEMPLATE[lang](categoryLabel, cityLabel);
  const description = DESC_TEMPLATE[lang](categoryLabel, cityLabel);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: hreflang(`/jobs/${slug}/${city}`),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'GigZone',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function JobCityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { lang, category, city } = params;

  if (!isValidCategory(category) || !isCitySlugValid(city)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const cityLabel = humanizeCity(city);
  const canonical = `${BASE_URL}/${lang}/jobs/${slug}/${city}`;
  const categoryUrl = `${BASE_URL}/${lang}/jobs/${slug}`;
  const jobsUrl = `${BASE_URL}/${lang}/jobs`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: lang === 'sr' ? 'Poslovi' : 'Jobs', item: jobsUrl },
      { '@type': 'ListItem', position: 3, name: categoryLabel, item: categoryUrl },
      { '@type': 'ListItem', position: 4, name: cityLabel, item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
