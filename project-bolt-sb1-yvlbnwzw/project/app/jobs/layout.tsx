import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poslovi i zapošljavanje — GigZone',
  description:
    'Pronađite posao ili zaposlite radnike. Hiljade oglasa za posao i traženje radnika na jednom mjestu.',
  keywords: [
    'posao', 'zapošljavanje', 'tražim posao', 'tražim radnika', 'oglasi za posao',
    'jobs', 'employment', 'hiring', 'work', 'gigzone',
  ],
  openGraph: {
    title: 'Poslovi i zapošljavanje — GigZone',
    description: 'Pronađite posao ili zaposlite radnike. Hiljade oglasa na jednom mjestu.',
    url: 'https://www.gigzone.app/jobs',
    siteName: 'GigZone',
    type: 'website',
  },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
