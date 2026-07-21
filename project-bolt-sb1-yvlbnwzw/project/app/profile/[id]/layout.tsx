import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { id: string };
  children: React.ReactNode;
};

const fetchProfileMeta = cache(async (id: string) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('profiles')
    .select('id, name, bio, city, category, is_premium, avatar_url, average_rating, review_count')
    .eq('id', id)
    .single();

  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchProfileMeta(params.id);
  if (!data) notFound();

  const isPro = data.is_premium === true;
  const title = isPro
    ? `${data.name} — ${data.category ?? 'Profesionalac'} | GigZone`
    : `${data.name} | GigZone`;

  const cityPart = data.city ? `${data.city} · ` : '';
  const ratingPart =
    isPro && data.average_rating
      ? `${Number(data.average_rating).toFixed(1)}/5 (${data.review_count ?? 0} ocjena) · `
      : '';
  const description = data.bio
    ? `${cityPart}${ratingPart}${data.bio.slice(0, 140).replace(/\n/g, ' ')}`
    : `${cityPart}${ratingPart}Pogledajte profil na GigZone platformi.`;

  const image = data.avatar_url ?? undefined;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.gigzone.app/profile/${params.id}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.gigzone.app/profile/${params.id}`,
      siteName: 'GigZone',
      type: 'profile',
      firstName: data.name,
      username: params.id,
      ...(image ? { images: [{ url: image, width: 400, height: 400, alt: data.name }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProfileLayout({ children, params }: Props) {
  const data = await fetchProfileMeta(params.id);
  if (!data) notFound();

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://www.gigzone.app/profile/${params.id}`,
    name: data.name,
    url: `https://www.gigzone.app/profile/${params.id}`,
    ...(data.avatar_url ? { image: data.avatar_url } : {}),
    ...(data.bio ? { description: data.bio.slice(0, 200).replace(/\n/g, ' ') } : {}),
    ...(data.is_premium && data.category ? { jobTitle: data.category } : {}),
    ...(data.city ? {
      address: { '@type': 'PostalAddress', addressLocality: data.city },
    } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 2, name: 'Profili', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 3, name: data.name },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
