import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poslovi i zapošljavanje — GigZone',
  description:
    'Pronađite posao ili zaposlite radnike. Oglasi iz Srbije, Bosne, Hrvatske i dijaspore u Austriji, Njemačkoj i Švicarskoj.',
  keywords: [
    'posao', 'zapošljavanje', 'tražim posao', 'tražim radnika', 'oglasi za posao',
    'Srbija', 'Bosna', 'Hrvatska', 'Austrija', 'Njemačka', 'Švajcarska', 'gigzone',
  ],
  openGraph: {
    title: 'Poslovi i zapošljavanje — GigZone',
    description: 'Oglasi za posao i traženje radnika iz ex-YU dijaspore.',
    url: 'https://www.gigzone.app/jobs',
    siteName: 'GigZone',
    type: 'website',
  },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
