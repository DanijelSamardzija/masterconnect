import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

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

  const providerName = (data.profiles as any)?.name ?? 'GigZone';
  const serviceTitle = (data as any).job_title || (data as any).category || 'Usluga';
  const title = `${serviceTitle} — ${providerName}`;

  const description = data.text
    ? data.text.slice(0, 160).replace(/\n/g, ' ')
    : `${data.city ? data.city + ' · ' : ''}Usluga na GigZone platformi.`;

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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 2, name: 'Usluge', item: 'https://www.gigzone.app/sr/services' },
      { '@type': 'ListItem', position: 3, name: `${serviceTitle} — ${providerName}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
