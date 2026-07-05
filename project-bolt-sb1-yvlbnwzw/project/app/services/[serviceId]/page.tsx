import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchService(params.serviceId);
  if (!data) return { title: 'Usluga | GigZone' };

  const profile = data.profiles as any;
  const title = data.job_title || data.category || 'Usluga';
  const city = data.city || '';
  const name = profile?.name || '';
  const price = data.price_value ? `${data.price_value} ${data.currency || 'EUR'}` : '';

  const pageTitle = `${title}${city ? ` – ${city}` : ''}${name ? ` | ${name}` : ''} | GigZone`;
  const description = `${title}${city ? ` u ${city}` : ''}${price ? ` – ${price}` : ''}. ${(data.text || '').slice(0, 120)}`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: `https://gigzone.app/services/${params.serviceId}`,
    },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const data = await fetchService(params.serviceId);
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
    url: `https://gigzone.app/services/${data.id}`,
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
