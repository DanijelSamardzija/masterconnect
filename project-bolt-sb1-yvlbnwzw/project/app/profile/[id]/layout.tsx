import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { id: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('profiles')
    .select('id, name, bio, city, category, account_type, avatar_url, average_rating, review_count')
    .eq('id', params.id)
    .single();

  if (!data) {
    return {
      title: 'Profil — GigZone',
      description: 'Pogledajte profil na GigZone platformi.',
    };
  }

  const isPro = data.account_type === 'professional';
  const title = isPro
    ? `${data.name} — ${data.category ?? 'Profesionalac'} | GigZone`
    : `${data.name} | GigZone`;

  const cityPart = data.city ? `${data.city} · ` : '';
  const ratingPart =
    isPro && data.average_rating
      ? `⭐ ${Number(data.average_rating).toFixed(1)} (${data.review_count ?? 0} ocena) · `
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
      ...(image ? { images: [{ url: image, width: 400, height: 400, alt: data.name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
