import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = { params: Promise<{ businessId: string; serviceId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { businessId, serviceId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [bizRes, svcRes] = await Promise.all([
    supabase.from('booking_profiles').select('name').eq('id', businessId).eq('is_active', true).maybeSingle(),
    supabase.from('service_catalog')
      .select('name, description, price, price_type, currency, duration_minutes')
      .eq('id', serviceId)
      .maybeSingle(),
  ]);

  const biz = bizRes.data;
  const svc = svcRes.data;
  if (!biz || !svc) return {};

  const priceStr =
    svc.price && svc.price > 0 && svc.price_type !== 'negotiable'
      ? `${svc.price} ${svc.currency ?? ''}`.trim()
      : null;

  const title = `${svc.name} — ${biz.name}`;
  const description = [
    svc.description ?? null,
    `${svc.duration_minutes} min`,
    priceStr,
  ]
    .filter(Boolean)
    .join(' · ');

  const url = `https://gigzone.app/booking/${businessId}/${serviceId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'GigZone',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
