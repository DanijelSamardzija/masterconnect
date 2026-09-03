import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/categories';

type Props = {
  params: { serviceId: string };
  children: React.ReactNode;
};

const fetchServiceMeta = cache(async (serviceId: string) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select('id, job_title, category, text, city, price_value, price_type, currency, post_media(url, order, type), profiles(name, avatar_url, average_rating, review_count)')
    .eq('id', serviceId)
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .single();

  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchServiceMeta(params.serviceId);
  if (!data) notFound();

  const providerName = (data.profiles as any)?.name ?? '';
  const rawCat: string = (data as any).category ?? '';
  const validCat = isValidCategory(rawCat);
  const categoryLabel = validCat ? getCategoryLabel(rawCat as CategorySlug, 'sr') : null;
  const serviceTitle = (data as any).job_title || categoryLabel || 'Usluga';
  const city: string = (data as any).city ?? '';

  const titleParts = [
    city ? `${serviceTitle} u ${city}` : serviceTitle,
    providerName || null,
    'GigZone',
  ].filter(Boolean);
  const title = titleParts.join(' | ');

  const intro = city
    ? `Pronađite ${serviceTitle.toLowerCase()} u ${city}.`
    : `Pronađite ${serviceTitle.toLowerCase()}.`;

  const fallbackCta = providerName
    ? `Pogledajte fotografije, opis usluge i kontaktirajte ${providerName} direktno preko GigZone.`
    : 'Pogledajte fotografije, opis usluge i kontaktirajte pružaoca direktno preko GigZone.';

  const rawDesc = data.text
    ? `${intro} ${data.text.replace(/\n/g, ' ').trim()}`
    : `${intro} ${fallbackCta}`;

  const descCut = rawDesc.lastIndexOf(' ', 155);
  const description = rawDesc.length <= 155
    ? rawDesc
    : rawDesc.slice(0, descCut > 0 ? descCut : 155).trimEnd() + '…';

  const keywords = Array.from(new Set(
    [serviceTitle, categoryLabel, city, providerName, 'GigZone'].filter(Boolean)
  )) as string[];

  const mediaList = (data.post_media as any[]) ?? [];
  const firstImage = mediaList
    .filter((m) => m.type === 'image')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

  const hasMediaImage = !!firstImage;
  const imageUrl = firstImage?.url ?? (data.profiles as any)?.avatar_url ?? undefined;

  return {
    title,
    description,
    keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://www.gigzone.app/services/${params.serviceId}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.gigzone.app/services/${params.serviceId}`,
      siteName: 'GigZone',
      type: 'website',
      ...(imageUrl ? {
        images: [{
          url: imageUrl,
          width: hasMediaImage ? 1200 : 400,
          height: hasMediaImage ? 630 : 400,
          alt: title,
        }],
      } : {}),
    },
    twitter: {
      card: hasMediaImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function ServiceDetailLayout({ children, params }: Props) {
  const data = await fetchServiceMeta(params.serviceId);
  if (!data) notFound();

  const providerName = (data.profiles as any)?.name ?? 'GigZone';
  const serviceTitle = (data as any).job_title || (data as any).category || 'Usluga';
  const rawCategory: string = (data as any).category ?? '';
  const validCategory = isValidCategory(rawCategory);
  const categoryLabel = validCategory ? getCategoryLabel(rawCategory as CategorySlug, 'sr') : null;

  const city: string = (data as any).city ?? '';
  const rawText: string = (data as any).text ?? '';
  const priceValue: number | null = typeof (data as any).price_value === 'number' && (data as any).price_value > 0
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
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 2, name: 'Usluge', item: 'https://www.gigzone.app/services' },
      ...(validCategory && categoryLabel
        ? [{ '@type': 'ListItem', position: 3, name: categoryLabel, item: `https://www.gigzone.app/en/services/${rawCategory}` }]
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
