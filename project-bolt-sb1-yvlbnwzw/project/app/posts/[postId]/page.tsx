import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { SinglePostClient } from './post-client';

type Props = { params: { postId: string } };

async function fetchPostMeta(postId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select('id, text, post_type, author:profiles!posts_user_id_fkey(name)')
    .eq('id', postId)
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchPostMeta(params.postId);
  if (!data) return { title: 'Objava | GigZone' };

  const author = Array.isArray(data.author) ? data.author[0] : data.author;
  const name = (author as any)?.name || 'GigZone korisnik';
  const snippet = (data.text || '').slice(0, 150);

  const typeLabel =
    data.post_type === 'job_seeker_post' ? 'Tražim posao' :
    data.post_type === 'service_request' ? 'Tražim uslugu' :
    'Objava na GigZone';

  const title = `${name} – ${typeLabel} | GigZone`;
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

export default function SinglePostPage() {
  return <SinglePostClient />;
}
