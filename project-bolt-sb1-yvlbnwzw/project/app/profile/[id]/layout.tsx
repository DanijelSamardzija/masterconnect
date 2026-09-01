import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { BASE_URL } from '@/lib/i18n-config';

export const revalidate = 3600;

type Props = {
  params: { id: string };
  children: React.ReactNode;
};

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Four parallel queries per request (deduplicated via React cache across layout + generateMetadata):
//   1. Profile core fields
//   2. Does user have ≥1 active service listing?  (limit 1 — existence check only)
//   3. Does user have ≥1 non-deleted portfolio post? (limit 1 — existence check only)
//   4. Does user have ≥1 quality public Feed post? (limit 20, quality-checked in JS)
//      Quality rules mirror the noindex logic in [lang]/posts/[postId]/page.tsx:
//        hiring_post / job_seeker_post / service_request → always quality
//        portfolio_post / social_post → quality if spam_score < 0.5 AND (text ≥ 50 chars OR has media)
const fetchProfileMeta = cache(async (id: string) => {
  const supabase = makeSupabase();
  const [{ data: profile }, { data: svcRows }, { data: portRows }, { data: feedRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, bio, city, category, is_premium, avatar_url, average_rating, review_count')
      .eq('id', id)
      .single(),
    supabase
      .from('posts')
      .select('id')
      .eq('user_id', id)
      .eq('post_type', 'service_listing')
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('posts')
      .select('id')
      .eq('user_id', id)
      .eq('post_type', 'portfolio_post')
      .neq('status', 'deleted')
      .limit(1),
    supabase
      .from('posts')
      .select('id, post_type, text, spam_score, post_media(id)')
      .eq('user_id', id)
      .in('post_type', ['hiring_post', 'job_seeker_post', 'service_request', 'portfolio_post', 'social_post'])
      .neq('status', 'deleted')
      .limit(20),
  ]);
  if (!profile) return null;

  const hasQualityFeedPost = (feedRows || []).some((row) => {
    const pt = (row as any).post_type as string;
    if (['hiring_post', 'job_seeker_post', 'service_request'].includes(pt)) return true;
    const spamScore = ((row as any).spam_score as number) || 0;
    if (spamScore >= 0.5) return false;
    const textLen = ((row as any).text as string || '').length;
    const hasMedia = ((row as any).post_media as unknown[] || []).length > 0;
    return textLen >= 50 || hasMedia;
  });

  return {
    ...profile,
    hasServices: (svcRows?.length ?? 0) > 0,
    hasPortfolio: (portRows?.length ?? 0) > 0,
    hasQualityFeedPost,
  };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchProfileMeta(params.id);
  if (!data) notFound();

  const profileUrl = `${BASE_URL}/profile/${params.id}`;
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

  // Indexable if the profile has ANY professional content:
  //   bio ≥ 20 chars | review_count > 0 | professional category set | PRO status
  //   | ≥1 active service listing | ≥1 portfolio post
  const hasMeaningfulBio = data.bio != null && data.bio.trim().length >= 20;
  const hasReviews       = (data.review_count ?? 0) > 0;
  const hasPROCategory   = !!(data.category || data.is_premium);
  const isThin = !hasMeaningfulBio && !hasReviews && !hasPROCategory
               && !data.hasServices && !data.hasPortfolio && !data.hasQualityFeedPost;

  const keywords = [
    data.name,
    ...(data.category ? [data.category] : []),
    ...(data.city ? [data.city] : []),
    'GigZone',
    ...(isPro ? ['profesionalac', 'freelancer'] : []),
  ];

  const image = data.avatar_url ?? undefined;

  return {
    title,
    description,
    keywords,
    ...(isThin ? { robots: { index: false, follow: false } } : {}),
    alternates: {
      canonical: profileUrl,
      // Profile content is not language-specific (user-generated, single URL).
      // All hreflang variants point to the same URL to signal coverage of all markets.
      languages: {
        sr: profileUrl,
        en: profileUrl,
        de: profileUrl,
        'x-default': profileUrl,
      },
    },
    openGraph: {
      title,
      description,
      url: profileUrl,
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

  const profileUrl = `${BASE_URL}/profile/${params.id}`;

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': profileUrl,
    name: data.name,
    url: profileUrl,
    ...(data.avatar_url ? { image: data.avatar_url } : {}),
    ...(data.bio ? { description: data.bio.slice(0, 200).replace(/\n/g, ' ') } : {}),
    ...(data.is_premium && data.category ? { jobTitle: data.category } : {}),
    ...(data.city ? {
      address: { '@type': 'PostalAddress', addressLocality: data.city },
    } : {}),
    ...(data.average_rating && data.review_count && data.review_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(data.average_rating).toFixed(1),
            reviewCount: data.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  // Breadcrumb: position 2 has no item — there is no profiles listing page.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Profili' },
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
