import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'O platformi — GigZone',
  description:
    'GigZone je globalna platforma za poslove i usluge — za sve struke, sve gradove i sve delatnosti. Pronađi profesionalce, objavi uslugu ili potraži posao.',
  keywords: ['o platformi', 'gigzone', 'marketplace', 'usluge', 'poslovi', 'profesionalci'],
  alternates: { canonical: 'https://www.gigzone.app/o-platformi' },
  openGraph: {
    title: 'O platformi — GigZone',
    description:
      'GigZone je globalna platforma za poslove i usluge — za sve struke, sve gradove i sve delatnosti.',
    url: 'https://www.gigzone.app/o-platformi',
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
    title: 'O platformi — GigZone',
    description:
      'GigZone je globalna platforma za poslove i usluge — za sve struke, sve gradove i sve delatnosti.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

const aboutPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': 'https://www.gigzone.app/o-platformi#aboutpage',
  url: 'https://www.gigzone.app/o-platformi',
  name: 'About GigZone',
  description:
    'A global platform for jobs and services — every profession, every city, every industry. GigZone connects freelancers, companies, entrepreneurs and individuals worldwide.',
  isPartOf: { '@id': 'https://www.gigzone.app/#website' },
  mainEntity: { '@id': 'https://www.gigzone.app/#organization' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      {children}
    </>
  );
}
