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
    .from('jobs')
    .select('id, title, description, city, budget, category, profiles(name)')
    .eq('id', params.id)
    .single();

  if (!data) {
    return {
      title: 'Posao — GigZone',
      description: 'Pronađite posao ili objavite oglas na GigZone platformi.',
    };
  }

  const title = `${data.title} — GigZone`;
  const cityPart = data.city ? `${data.city} · ` : '';
  const budgetPart = data.budget ? `Budžet: ${data.budget} · ` : '';
  const description = data.description
    ? `${cityPart}${budgetPart}${data.description.slice(0, 140).replace(/\n/g, ' ')}`
    : `${cityPart}Oglas za posao na GigZone platformi.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.gigzone.app/jobs/${params.id}`,
      siteName: 'GigZone',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function JobDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
