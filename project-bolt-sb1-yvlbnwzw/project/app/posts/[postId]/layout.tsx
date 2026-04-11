import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { postId: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select('id, text, post_type, post_media(url, order, type), profiles(name, avatar_url)')
    .eq('id', params.postId)
    .single();

  if (!data) {
    return {
      title: 'Objava — GigZone',
      description: 'Pogledajte objavu na GigZone platformi.',
    };
  }

  const authorName = (data.profiles as any)?.name ?? 'GigZone';
  const title = `${authorName} na GigZone`;
  const description = data.text
    ? data.text.slice(0, 160).replace(/\n/g, ' ')
    : 'Pogledajte objavu na GigZone platformi.';

  const mediaList = (data.post_media as any[]) ?? [];
  const firstImage = mediaList
    .filter((m) => m.type === 'image')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

  const image = firstImage?.url ?? (data.profiles as any)?.avatar_url ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.gigzone.app/posts/${params.postId}`,
      siteName: 'GigZone',
      type: 'article',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function PostDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
