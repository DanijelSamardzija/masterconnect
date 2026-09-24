import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = { params: Promise<{ businessId: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data } = await supabase
    .from('booking_profiles')
    .select('name, description, avatar_url')
    .eq('id', businessId)
    .eq('is_active', true)
    .neq('profile_type', 'tradespeople')
    .maybeSingle();

  // Fetch primary city for description enrichment
  const { data: locData } = await supabase
    .from('business_locations')
    .select('city')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return {};

  const city = locData?.city ?? null;
  const title = data.name;
  const description = [data.description, city].filter(Boolean).join(' · ') || data.name;
  const url = `https://gigzone.app/booking/${businessId}`;
  const imageUrl = data.avatar_url as string | null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'GigZone',
      ...(imageUrl ? { images: [{ url: imageUrl, width: 400, height: 400 }] } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default function BusinessBookingProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
