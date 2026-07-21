import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
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

export default async function JobDetailsPage({ params }: Props) {
  const data = await fetchJob(params.id);
  if (!data) notFound();

  const jsonLd = {
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
      sameAs: 'https://www.gigzone.app',
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
    url: `https://www.gigzone.app/jobs/${data.id}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JobDetailsClient jobId={params.id} initialData={data as any} />
    </>
  );
}
