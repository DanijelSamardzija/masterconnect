import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pomoć i podrška — GigZone',
  description:
    'Pronađite odgovore na česta pitanja o GigZone platformi. Krediti, objave, usluge, poslovi i sve što trebate znati.',
  keywords: ['pomoć', 'podrška', 'FAQ', 'pitanja', 'uputstvo', 'gigzone'],
  alternates: { canonical: 'https://www.gigzone.app/help' },
  openGraph: {
    title: 'Pomoć i podrška — GigZone',
    description: 'Odgovori na česta pitanja o GigZone platformi — krediti, objave, usluge i poslovi.',
    url: 'https://www.gigzone.app/help',
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
    title: 'Pomoć i podrška — GigZone',
    description: 'Odgovori na česta pitanja o GigZone platformi.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
