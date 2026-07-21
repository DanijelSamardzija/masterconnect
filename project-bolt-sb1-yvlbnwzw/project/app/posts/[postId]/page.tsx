import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { SinglePostClient } from './post-client';

type Props = { params: { postId: string } };

const fetchPostMeta = cache(async (postId: string) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select('id, text, job_title, post_type, city, created_at, author:profiles!posts_user_id_fkey(name)')
    .eq('id', postId)
    .maybeSingle();

  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchPostMeta(params.postId);
  if (!data) notFound();

  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  const name = (author as any)?.name || 'GigZone korisnik';

  const typeLabel =
    data.post_type === 'hiring_post'     ? 'Oglas za posao' :
    data.post_type === 'job_seeker_post'  ? 'Tražim posao' :
    data.post_type === 'service_request'  ? 'Tražim uslugu' :
    data.post_type === 'portfolio_post'   ? 'Portfolio' :
    'Objava';

  const headlineText = (data as any).job_title || (data.text || '').slice(0, 60) || typeLabel;
  const title = `${name} – ${headlineText} | GigZone`;

  const snippet = (data.text || '').slice(0, 150);
  const description = snippet || `${typeLabel} od ${name} na GigZone platformi.`;

  const ogImage = `https://www.gigzone.app/api/og?postId=${params.postId}`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.gigzone.app/posts/${params.postId}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.gigzone.app/posts/${params.postId}`,
      siteName: 'GigZone',
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SinglePostPage({ params }: Props) {
  const data = await fetchPostMeta(params.postId);
  if (!data) notFound();

  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  const name = (author as any)?.name || 'GigZone korisnik';

  const typeLabel =
    data.post_type === 'hiring_post'    ? 'Oglasi za posao' :
    data.post_type === 'job_seeker_post' ? 'Tražim posao' :
    data.post_type === 'service_request' ? 'Tražim uslugu' :
    'Objave';

  const parentUrl = ['social_post', 'portfolio_post'].includes(data.post_type)
    ? 'https://www.gigzone.app/feed'
    : 'https://www.gigzone.app/sr/jobs';
  const parentName = ['social_post', 'portfolio_post'].includes(data.post_type)
    ? 'Feed'
    : typeLabel;

  const headlineText = (data as any).job_title || (data.text || '').slice(0, 60) || 'Objava';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
      { '@type': 'ListItem', position: 2, name: parentName, item: parentUrl },
      { '@type': 'ListItem', position: 3, name: `${name} – ${headlineText}` },
    ],
  };

  const jobPostingJsonLd = data.post_type === 'hiring_post' ? {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: (data as any).job_title || (data.text || '').slice(0, 100) || 'Oglas za posao',
    description: data.text || (data as any).job_title || 'Oglas za posao na GigZone platformi.',
    datePosted: (data as any).created_at,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'GigZone',
      sameAs: 'https://www.gigzone.app',
    },
    url: `https://www.gigzone.app/posts/${data.id}`,
    ...((data as any).city ? {
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: (data as any).city },
      },
    } : {}),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {jobPostingJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }} />
      )}
      <SinglePostClient />
    </>
  );
}
