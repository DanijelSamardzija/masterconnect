import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Uslovi korišćenja — GigZone',
  description:
    'Pročitajte uslove korišćenja GigZone platforme. Pravila i obaveze za korisnike, profesionalce i kompanije.',
  keywords: ['uslovi korišćenja', 'pravila', 'politika', 'gigzone'],
  alternates: { canonical: 'https://www.gigzone.app/terms' },
  openGraph: {
    title: 'Uslovi korišćenja — GigZone',
    description: 'Pravila i obaveze za korisnike, profesionalce i kompanije na GigZone platformi.',
    url: 'https://www.gigzone.app/terms',
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
    title: 'Uslovi korišćenja — GigZone',
    description: 'Pravila i obaveze za korisnike GigZone platforme.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
