import type { Metadata } from 'next';
import { pageMeta, hreflang, Lang } from '@/lib/i18n-config';

export function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Metadata {
  const lang = (params.lang as Lang) || 'en';
  const meta = pageMeta.invest[lang] ?? pageMeta.invest.en;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `https://www.gigzone.app/${lang}/invest`,
      languages: hreflang('/invest'),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://www.gigzone.app/${lang}/invest`,
      siteName: 'GigZone',
      type: 'website',
    },
  };
}

export default function LangInvestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
