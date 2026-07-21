import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { serviceId: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select('id, job_title, category, text, city, post_media(url, order, type), profiles(name, avatar_url)')
    .eq('id', params.serviceId)
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .single();

  if (!data) {
    return {
      title: 'Usluga — GigZone',
      description: 'Pronađite majstore i usluge na GigZone platformi.',
    };
  }

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

  // Use post media (landscape) or avatar (square) — declare correct dimensions for each
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

export default function ServiceDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
