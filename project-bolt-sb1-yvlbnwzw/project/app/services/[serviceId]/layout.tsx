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
    .select('id, job_title, category, text, city, post_media(url, order, type), profiles(name, avatar_url)')
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
  const serviceTitle = (data as any).job_title || (data as any).category || 'Usluga';
  const city: string = (data as any).city ?? '';

  const titleParts = [
    city ? `${serviceTitle} u ${city}` : serviceTitle,
    providerName || null,
    'GigZone',
  ].filter(Boolean);
  const title = titleParts.join(' | ');

  const intro = city
    ? `Pronađite profesionalnog ${serviceTitle.toLowerCase()} u ${city}.`
    : `Pronađite profesionalnog ${serviceTitle.toLowerCase()}.`;

  const description = data.text
    ? `${intro} ${data.text.replace(/\n/g, ' ')}`.slice(0, 155).trimEnd()
    : `${intro} Pogledajte uslugu, fotografije i kontaktirajte direktno preko GigZone.`;

  const mediaList = (data.post_media as any[]) ?? [];
  const firstImage = mediaList
    .filter((m) => m.type === 'image')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

  const hasMediaImage = !!firstImage;
  const imageUrl = firstImage?.url ?? (data.profiles as any)?.avatar_url ?? undefined;

  return {
    title,
    description,
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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 2, name: 'Usluge', item: 'https://www.gigzone.app/services' },
      ...(validCategory && categoryLabel
        ? [{ '@type': 'ListItem', position: 3, name: categoryLabel, item: `https://www.gigzone.app/sr/services/${rawCategory}` }]
        : []),
      { '@type': 'ListItem', position: validCategory ? 4 : 3, name: `${serviceTitle} — ${providerName}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
