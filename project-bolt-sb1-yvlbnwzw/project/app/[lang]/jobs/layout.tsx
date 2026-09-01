import type { Metadata } from 'next';
import { pageMeta, hreflang, Lang } from '@/lib/i18n-config';

export function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Metadata {
  const lang = (params.lang as Lang) || 'en';
  const meta = pageMeta.jobs[lang] ?? pageMeta.jobs.en;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `https://www.gigzone.app/${lang}/jobs`,
      languages: hreflang('/jobs'),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://www.gigzone.app/${lang}/jobs`,
      siteName: 'GigZone',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
  };
}

export default function LangJobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
