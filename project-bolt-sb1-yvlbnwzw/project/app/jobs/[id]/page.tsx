import { createClient } from '@supabase/supabase-js';
import { JobDetailsClient } from './job-details-client';

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('jobs')
    .select('*, customer:profiles!jobs_customer_id_fkey(name, email)')
    .eq('id', params.id)
    .maybeSingle();

  return <JobDetailsClient jobId={params.id} initialData={data as any} />;
}
