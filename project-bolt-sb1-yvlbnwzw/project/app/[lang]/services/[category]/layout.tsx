import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { BASE_URL, SUPPORTED_LANGS, hreflang, type Lang } from '@/lib/i18n-config';
import {
  isValidCategory,
  CATEGORY_SEO,
  CATEGORY_SLUGS,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/seo/categories';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { lang: Lang; category: string };

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const fetchServiceMeta = cache(async (serviceId: string) => {
  const { data } = await makeSupabase()
    .from('posts')
    .select('id, job_title, category, text, city, price_value, price_type, currency, post_media(url, order, type), profiles(name, avatar_url, average_rating, review_count)')
    .eq('id', serviceId)
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .single();
  return data;
});

const SERVICES_LABEL: Record<Lang, string> = {
  sr: 'Usluge',
  en: 'Services',
  de: 'Dienstleistungen',
  es: 'Servicios',
  fr: 'Services',
};

function buildServiceTitle(lang: Lang, serviceTitle: string, providerName: string, city: string): string {
  const cityPart = city ? (lang === 'sr' ? ` u ${city}` : ` in ${city}`) : '';
  const parts = [`${serviceTitle}${cityPart}`, providerName || null, 'GigZone'].filter(Boolean);
  return (parts as string[]).join(' | ');
}

function buildServiceDescription(lang: Lang, serviceTitle: string, providerName: string, city: string, text: string): string {
  const lowerTitle = serviceTitle.toLowerCase();
  let intro: string;
  if (lang === 'de') {
    intro = city ? `Finden Sie ${lowerTitle} in ${city}.` : `Finden Sie ${lowerTitle}.`;
  } else if (lang === 'en') {
    intro = city ? `Find ${lowerTitle} in ${city}.` : `Find ${lowerTitle}.`;
  } else {
    intro = city ? `Pronađite ${lowerTitle} u ${city}.` : `Pronađite ${lowerTitle}.`;
  }
  const name = providerName || (lang === 'de' ? 'den Anbieter' : lang === 'en' ? 'the provider' : 'pružaoca');
  const fallback = lang === 'de'
    ? `Fotos und Beschreibung ansehen und ${name} direkt über GigZone kontaktieren.`
    : lang === 'en'
    ? `View photos and description and contact ${name} directly via GigZone.`
    : `Pogledajte fotografije i opis i kontaktirajte ${name} direktno preko GigZone.`;
  const rawDesc = text ? `${intro} ${text.replace(/\n/g, ' ').trim()}` : `${intro} ${fallback}`;
  const cutAt = rawDesc.lastIndexOf(' ', 155);
  return rawDesc.length <= 155 ? rawDesc : rawDesc.slice(0, cutAt > 0 ? cutAt : 155).trimEnd() + '…';
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, category } = params;

  // UUID: individual service detail metadata (lang-specific)
  if (UUID_RE.test(category)) {
    const data = await fetchServiceMeta(category);
    if (!data) return {};

    const providerName = (data.profiles as any)?.name ?? '';
    const rawCat: string = (data as any).category ?? '';
    const validCat = isValidCategory(rawCat);
    const categoryLabel = validCat ? getCategoryLabel(rawCat as CategorySlug, lang) : null;
    const defaultServiceName = lang === 'de' ? 'Dienstleistung' : lang === 'en' ? 'Service' : 'Usluga';
    const serviceTitle = (data as any).job_title || categoryLabel || defaultServiceName;
    const city: string = (data as any).city ?? '';
    const text: string = (data as any).text ?? '';

    const title = buildServiceTitle(lang, serviceTitle, providerName, city);
    const description = buildServiceDescription(lang, serviceTitle, providerName, city, text);
    const canonical = `${BASE_URL}/${lang}/services/${category}`;

    const mediaList = (data.post_media as any[]) ?? [];
    const firstImage = mediaList
      .filter((m) => m.type === 'image')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    const hasMediaImage = !!firstImage;
    const imageUrl = firstImage?.url ?? (data.profiles as any)?.avatar_url ?? undefined;

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: hreflang(`/services/${category}`),
      },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: 'GigZone',
        type: 'website',
        ...(imageUrl
          ? { images: [{ url: imageUrl, width: hasMediaImage ? 1200 : 400, height: hasMediaImage ? 630 : 400, alt: title }] }
          : {}),
      },
      twitter: {
        card: hasMediaImage ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  }

  if (!isValidCategory(category)) return {};

  const slug = category as CategorySlug;
  const meta = CATEGORY_SEO[slug][lang];
  const canonical = `${BASE_URL}/${lang}/services/${slug}`;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical,
      languages: hreflang(`/services/${slug}`),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: 'GigZone',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
  };
}

export function generateStaticParams() {
  return SUPPORTED_LANGS.flatMap((lang) =>
    CATEGORY_SLUGS.map((category) => ({ lang, category }))
  );
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { lang, category } = params;

  // UUID: render service JSON-LD + breadcrumb for individual service detail
  if (UUID_RE.test(category)) {
    const data = await fetchServiceMeta(category);
    if (!data) notFound();

    const providerName = (data.profiles as any)?.name ?? 'GigZone';
    const serviceTitle = (data as any).job_title || (data as any).category || 'Usluga';
    const rawCategory: string = (data as any).category ?? '';
    const validCategory = isValidCategory(rawCategory);
    const categoryLabel = validCategory ? getCategoryLabel(rawCategory as CategorySlug, lang) : null;
    const city: string = (data as any).city ?? '';
    const rawText: string = (data as any).text ?? '';
    const priceValue: number | null =
      typeof (data as any).price_value === 'number' && (data as any).price_value > 0
        ? (data as any).price_value
        : null;
    const currency: string | null = (data as any).currency ?? null;
    const avgRating: number | null = (data.profiles as any)?.average_rating ?? null;
    const reviewCount: number | null = (data.profiles as any)?.review_count ?? null;

    const serviceJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: serviceTitle,
      ...(rawText ? { description: rawText.slice(0, 300).replace(/\n/g, ' ') } : {}),
      provider: { '@type': 'Person', name: providerName },
      ...(categoryLabel ? { serviceType: categoryLabel } : {}),
      ...(city ? { areaServed: { '@type': 'City', name: city } } : {}),
      ...(priceValue !== null && currency
        ? { offers: { '@type': 'Offer', price: priceValue, priceCurrency: currency } }
        : {}),
      ...(avgRating !== null && reviewCount !== null && reviewCount > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(avgRating).toFixed(1),
              reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };

    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'GigZone', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: SERVICES_LABEL[lang], item: `${BASE_URL}/${lang}/services` },
        ...(validCategory && categoryLabel
          ? [{ '@type': 'ListItem', position: 3, name: categoryLabel, item: `${BASE_URL}/${lang}/services/${rawCategory}` }]
          : []),
        { '@type': 'ListItem', position: validCategory ? 4 : 3, name: `${serviceTitle} — ${providerName}` },
      ],
    };

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        {children}
      </>
    );
  }

  if (!isValidCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const canonical = `${BASE_URL}/${lang}/services/${slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: SERVICES_LABEL[lang], item: `${BASE_URL}/${lang}/services` },
      { '@type': 'ListItem', position: 3, name: categoryLabel, item: canonical },
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
