import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BASE_URL, SUPPORTED_LANGS, hreflang, type Lang } from '@/lib/i18n-config';
import {
  JOB_CATEGORY_SEO,
  CATEGORY_SLUGS,
  isValidCategory,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/seo/job-categories';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { lang: Lang; category: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, category } = params;

  if (UUID_RE.test(category) || !isValidCategory(category)) return {};

  const slug = category as CategorySlug;
  const meta = JOB_CATEGORY_SEO[slug][lang];
  const canonical = `${BASE_URL}/${lang}/jobs/${slug}`;

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical,
      languages: hreflang(`/jobs/${slug}`),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
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

export function generateStaticParams() {
  return SUPPORTED_LANGS.flatMap((lang) =>
    CATEGORY_SLUGS.map((category) => ({ lang, category }))
  );
}

export default function JobCategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { lang, category } = params;

  if (UUID_RE.test(category)) {
    redirect(`/posts/${category}`);
  }

  if (!isValidCategory(category)) {
    notFound();
  }

  const slug = category as CategorySlug;
  const categoryLabel = getCategoryLabel(slug, lang);
  const canonical = `${BASE_URL}/${lang}/jobs/${slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GigZone', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: lang === 'sr' ? 'Poslovi' : lang === 'de' ? 'Jobs' : 'Jobs', item: `${BASE_URL}/${lang}/jobs` },
      { '@type': 'ListItem', position: 3, name: categoryLabel, item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
