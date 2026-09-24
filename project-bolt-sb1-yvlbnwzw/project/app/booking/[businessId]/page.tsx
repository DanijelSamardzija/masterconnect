import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import BusinessBookingProfilePageClient from './_page-client';

type Props = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ locationId?: string }>;
};

/**
 * When a specific locationId is present in the URL, override the layout's base
 * metadata with location-specific title and description so that WhatsApp/Viber/
 * Messenger previews reflect the chosen location rather than the primary one.
 * Without locationId this returns {} and the layout's generateMetadata applies.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { businessId } = await params;
  const { locationId } = await searchParams;

  if (!locationId) return {};

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [bpRes, locRes] = await Promise.all([
    supabase
      .from('booking_profiles')
      .select('name, description, avatar_url')
      .eq('id', businessId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('business_locations')
      .select('name, city, country')
      .eq('id', locationId)
      .maybeSingle(),
  ]);

  const bp = bpRes.data;
  const loc = locRes.data;
  if (!bp || !loc) return {};

  const locationLabel = [loc.name, loc.city].filter(Boolean).join(', ');
  const title = locationLabel ? `${bp.name} — ${locationLabel}` : bp.name;
  const description = [bp.description, locationLabel].filter(Boolean).join(' · ') || bp.name;
  const url = `https://gigzone.app/booking/${businessId}?locationId=${locationId}`;
  const imageUrl = bp.avatar_url as string | null;

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

export default function BusinessBookingProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BusinessBookingProfilePageClient />
    </Suspense>
  );
}
