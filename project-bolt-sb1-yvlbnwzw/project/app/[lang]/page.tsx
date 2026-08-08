import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n-config';
import { pageMeta, hreflang, BASE_URL } from '@/lib/i18n-config';
import { HomeClient } from '@/app/home-client';

type Props = { params: { lang: Lang } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = params;
  const meta = pageMeta.homepage[lang] ?? pageMeta.homepage.en;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `${BASE_URL}/${lang}`,
      languages: hreflang(''),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}/${lang}`,
      siteName: 'GigZone',
      type: 'website',
      images: [
        {
          url: 'https://www.gigzone.app/icon-512.png',
          width: 512,
          height: 512,
          alt: 'GigZone logo',
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
      images: ['https://www.gigzone.app/icon-512.png'],
    },
  };
}

export default function LangHomePage() {
  return <HomeClient />;
}
