import type { Metadata } from 'next';

// /jobs is always redirected to /{lang}/jobs by middleware before rendering.
// noindex is a safety net in case middleware is ever bypassed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
