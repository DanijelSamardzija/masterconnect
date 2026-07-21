import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ServiceDetailClient } from './service-detail-client';

type Props = { params: { serviceId: string } };

async function fetchService(serviceId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('posts')
    .select(`
      id,
      user_id,
      text,
      job_title,
      category,
      city,
      price_type,
      price_value,
      currency,
      created_at,
      profiles (
        name,
        avatar_url,
        account_type,
        average_rating,
        review_count,
        phone,
        show_phone
      ),
      post_media (
        id,
        type,
        url,
        order
      )
    `)
    .eq('id', serviceId)
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .maybeSingle();

  return data;
}

export default async function ServiceDetailPage({ params }: Props) {
  const data = await fetchService(params.serviceId);
  if (!data) notFound();
  const profile = (data as any)?.profiles as any;

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: data.job_title || data.category || 'Usluga',
    description: data.text || '',
    areaServed: data.city || undefined,
    serviceType: data.category || undefined,
    provider: {
      '@type': 'Person',
      name: profile?.name || 'GigZone korisnik',
    },
    offers: data.price_value ? {
      '@type': 'Offer',
      price: data.price_value,
      priceCurrency: data.currency || 'EUR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceType: data.price_type === 'hourly' ? 'https://schema.org/MinimumAdvertisedPrice' : undefined,
      },
    } : undefined,
    url: `https://www.gigzone.app/services/${data.id}`,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ServiceDetailClient serviceId={params.serviceId} initialData={data as any} />
    </>
  );
}
