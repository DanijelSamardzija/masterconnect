import type { Metadata } from 'next';

// /services is always redirected to /{lang}/services by middleware before rendering.
// noindex is a safety net in case middleware is ever bypassed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
