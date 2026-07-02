import { createClient } from '@supabase/supabase-js';
import { ServiceDetailClient } from './service-detail-client';

export default async function ServiceDetailPage({ params }: { params: { serviceId: string } }) {
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
    .eq('id', params.serviceId)
    .eq('post_type', 'service_listing')
    .eq('is_active', true)
    .maybeSingle();

  return <ServiceDetailClient serviceId={params.serviceId} initialData={data as any} />;
}
