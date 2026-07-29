import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n-config';
import { BASE_URL, hreflang } from '@/lib/i18n-config';
import { isValidCategory } from '@/lib/seo/categories';
import { ServicesClient } from '@/app/services/services-client';

// When a valid category filter is active, the canonical points to the landing page
// so Google consolidates equity to /[lang]/services/[category] rather than indexing
// the filter URL as a separate page.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { lang: Lang };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const { lang } = params;
  const raw = searchParams['category'];
  const category = Array.isArray(raw) ? raw[0] : raw;

  if (category && isValidCategory(category)) {
    const canonical = `${BASE_URL}/${lang}/services/${category}`;
    return {
      alternates: {
        canonical,
        languages: hreflang(`/services/${category}`),
      },
    };
  }

  return {};
}

export default function LangServicesPage() {
  return <ServicesClient />;
}
