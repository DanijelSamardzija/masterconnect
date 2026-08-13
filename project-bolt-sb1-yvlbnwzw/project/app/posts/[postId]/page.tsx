import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { SinglePostClient, type RelatedPost } from './post-client';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/categories';

export const revalidate = 300; // ISR: revalidate every 5 minutes; cleared immediately on edit/delete via revalidatePath

type Props = { params: { postId: string } };

const JOB_POST_TYPES = ['hiring_post', 'job_seeker_post', 'service_request'] as const;

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const fetchPostMeta = cache(async (postId: string) => {
  const supabase = makeSupabase();
  const { data } = await supabase
    .from('posts')
    .select('id, user_id, text, job_title, post_type, city, country, category, experience_level, availability, created_at, is_pinned, pinned_at, price_type, price_value, currency, author:profiles!posts_user_id_fkey(id, name, email, avatar_url, account_type, average_rating, review_count, phone, show_phone)')
    .eq('id', postId)
    .maybeSingle();
  return data;
});

async function fetchRelatedPosts(
  postId: string,
  category: string | null,
  city: string | null,
  postType: string,
): Promise<RelatedPost[]> {
  if (!category) return [];
  const supabase = makeSupabase();
  const { data } = await supabase
    .from('posts')
    .select('id, job_title, text, post_type, city, category, created_at, author:profiles!posts_user_id_fkey(name)')
    .eq('post_type', postType)
    .eq('category', category)
    .neq('id', postId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (!data?.length) return [];
  const lowerCity = city?.toLowerCase() ?? '';
  const sorted = [...data].sort((a, b) => {
    const aMatch = lowerCity && (a as any).city?.toLowerCase() === lowerCity ? 0 : 1;
    const bMatch = lowerCity && (b as any).city?.toLowerCase() === lowerCity ? 0 : 1;
    return aMatch - bMatch;
  });
  return sorted.slice(0, 6).map(p => {
    const author = Array.isArray((p as any).author) ? (p as any).author[0] : (p as any).author;
    return {
      id: (p as any).id,
      job_title: (p as any).job_title ?? null,
      text: (p as any).text ?? null,
      post_type: (p as any).post_type,
      city: (p as any).city ?? null,
      category: (p as any).category ?? null,
      created_at: (p as any).created_at,
      author_name: (author as any)?.name ?? 'GigZone korisnik',
    };
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchPostMeta(params.postId);
  if (!data) notFound();

  const author = Array.isArray((data as any).author) ? (data as any).author[0] : (data as any).author;
  const name = (author as any)?.name || 'GigZone korisnik';
  const postType = (data as any).post_type as string;

  const typeLabel =
    postType === 'hiring_post'    ? 'Oglas za posao' :
    postType === 'job_seeker_post' ? 'Tražim posao' :
    postType === 'service_request' ? 'Tražim uslugu' :
    postType === 'portfolio_post'  ? 'Portfolio' :
    'Objava';

  const jobTitle = (data as any).job_title as string | null;
  const text = (data as any).text as string | null;
  const city = (data as any).city as string | null;

  const rawHeadline = jobTitle || (text || '').slice(0, 60) || typeLabel;
  const headlineText = rawHeadline.slice(0, 80);
  const truncName = name.slice(0, 45);
  const truncCity = city ? city.slice(0, 30) : null;
  const cityPart = truncCity && JOB_POST_TYPES.includes(postType as any) ? ` – ${truncCity}` : '';
  const title = `${truncName} – ${headlineText}${cityPart} | GigZone`;

  const snippet = (text || '').slice(0, 150);
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
      publishedTime: (data as any).created_at as string,
      authors: (data as any).user_id ? [`https://www.gigzone.app/profile/${(data as any).user_id}`] : undefined,
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
  const rawData = await fetchPostMeta(params.postId);
  if (!rawData) notFound();

  const author = Array.isArray((rawData as any).author) ? (rawData as any).author[0] : (rawData as any).author;
  const name = (author as any)?.name || 'GigZone korisnik';
  const postType = (rawData as any).post_type as string;

  const typeLabel =
    postType === 'hiring_post'    ? 'Oglasi za posao' :
    postType === 'job_seeker_post' ? 'Tražim posao' :
    postType === 'service_request' ? 'Tražim uslugu' :
    'Objave';

  const parentUrl = ['social_post', 'portfolio_post'].includes(postType)
    ? 'https://www.gigzone.app/feed'
    : 'https://www.gigzone.app/sr/jobs';
  const parentName = ['social_post', 'portfolio_post'].includes(postType)
    ? 'Feed'
    : typeLabel;

  const jobTitle = (rawData as any).job_title as string | null;
  const text = (rawData as any).text as string | null;
  const headlineText = jobTitle || (text || '').slice(0, 60) || 'Objava';

  const rawCategory = ((rawData as any).category as string) ?? '';
  const validCategory = isValidCategory(rawCategory);
  const categoryLabel = validCategory ? getCategoryLabel(rawCategory as CategorySlug, 'sr') : null;
  const isJobPost = JOB_POST_TYPES.includes(postType as any);

  // Breadcrumb JSON-LD — category step added for job post types
  const breadcrumbItems: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: 'GigZone', item: 'https://www.gigzone.app' },
    { '@type': 'ListItem', position: 2, name: parentName, item: parentUrl },
  ];
  if (isJobPost && validCategory && categoryLabel) {
    breadcrumbItems.push({
      '@type': 'ListItem', position: 3, name: categoryLabel,
      item: `https://www.gigzone.app/sr/jobs/${rawCategory}`,
    });
    breadcrumbItems.push({ '@type': 'ListItem', position: 4, name: `${name} – ${headlineText}` });
  } else {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: `${name} – ${headlineText}` });
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const city = (rawData as any).city as string | null;
  const country = (rawData as any).country as string | null;
  const category = (rawData as any).category as string | null;

  const jobPostingJsonLd = postType === 'hiring_post' ? {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: jobTitle || (text || '').slice(0, 100) || 'Oglas za posao',
    description: text || jobTitle || 'Oglas za posao na GigZone platformi.',
    datePosted: (rawData as any).created_at,
    hiringOrganization: {
      '@type': 'Organization',
      name,
      sameAs: `https://www.gigzone.app/profile/${(rawData as any).user_id}`,
    },
    url: `https://www.gigzone.app/posts/${(rawData as any).id}`,
    ...(city ? {
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: city,
          ...(country ? { addressCountry: country } : {}),
        },
      },
    } : {}),
    ...(rawCategory && validCategory ? { occupationalCategory: getCategoryLabel(rawCategory as CategorySlug, 'sr') } : {}),
    ...(() => {
      const priceType = (rawData as any).price_type as string | null;
      const priceValue = (rawData as any).price_value as number | null;
      const currency = (rawData as any).currency as string | null;
      if (priceType === 'hourly' && priceValue != null && priceValue > 0 && currency) {
        return {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency,
            value: {
              '@type': 'QuantitativeValue',
              value: priceValue,
              unitText: 'HOUR',
            },
          },
        };
      }
      return {};
    })(),
  } : null;

  const initialData = {
    id: (rawData as any).id as string,
    user_id: (rawData as any).user_id as string,
    text: (rawData as any).text as string | null ?? null,
    job_title: (rawData as any).job_title as string | null ?? null,
    post_type: postType,
    city,
    country,
    category,
    experience_level: (rawData as any).experience_level as string | null ?? null,
    availability: (rawData as any).availability as string | null ?? null,
    created_at: (rawData as any).created_at as string,
    is_pinned: ((rawData as any).is_pinned as boolean) ?? false,
    pinned_at: (rawData as any).pinned_at as string | null ?? null,
    user: {
      id: ((author as any)?.id as string) ?? '',
      name: ((author as any)?.name as string) ?? 'GigZone korisnik',
      email: ((author as any)?.email as string) ?? '',
      avatar_url: ((author as any)?.avatar_url as string | null) ?? null,
      account_type: (((author as any)?.account_type as string) ?? 'professional') as 'professional' | 'customer',
      average_rating: (author as any)?.average_rating as number | undefined,
      review_count: (author as any)?.review_count as number | undefined,
      phone: ((author as any)?.phone as string | null) ?? null,
      show_phone: ((author as any)?.show_phone as boolean) ?? true,
    },
  };

  const relatedPosts = isJobPost
    ? await fetchRelatedPosts(initialData.id, category, city, postType)
    : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {jobPostingJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }} />
      )}
      <SinglePostClient initialData={initialData} relatedPosts={relatedPosts} />
    </>
  );
}
