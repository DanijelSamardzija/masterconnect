import type { Metadata } from 'next';
import { pageMeta, hreflang, Lang } from '@/lib/i18n-config';

export function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Metadata {
  const lang = (params.lang as Lang) || 'en';
  const meta = pageMeta.services[lang] ?? pageMeta.services.en;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `https://www.gigzone.app/${lang}/services`,
      languages: hreflang('/services'),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://www.gigzone.app/${lang}/services`,
      siteName: 'GigZone',
      type: 'website',
    },
  };
}

export default function LangServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
