import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { JobDetailsClient } from './job-details-client';

type Props = { params: { id: string } };

async function fetchJob(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('jobs')
    .select('*, customer:profiles!jobs_customer_id_fkey(name, email)')
    .eq('id', id)
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchJob(params.id);
  if (!data) return { title: 'Posao | GigZone' };

  const city = data.city || '';
  const pageTitle = `${data.title}${city ? ` – ${city}` : ''} | GigZone`;
  const description = `${data.title}${city ? ` u ${city}` : ''}${data.budget ? ` – Budžet: ${data.budget}` : ''}. ${(data.description || '').slice(0, 120)}`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: `https://gigzone.app/jobs/${params.id}`,
    },
  };
}

export default async function JobDetailsPage({ params }: Props) {
  const data = await fetchJob(params.id);

  const jsonLd = data ? {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: data.title,
    description: data.description || data.title,
    jobLocation: data.city ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: data.city,
      },
    } : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'GigZone',
      sameAs: 'https://gigzone.app',
    },
    datePosted: data.created_at,
    employmentType: 'CONTRACTOR',
    jobLocationType: 'TELECOMMUTE',
    baseSalary: data.budget ? {
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      value: {
        '@type': 'QuantitativeValue',
        value: data.budget,
      },
    } : undefined,
    url: `https://gigzone.app/jobs/${data.id}`,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <JobDetailsClient jobId={params.id} initialData={data as any} />
    </>
  );
}
