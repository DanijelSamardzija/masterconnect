import { Metadata } from 'next';
import { InvestClient } from './invest-client';

export const metadata: Metadata = {
  title: 'GigZone Invest — Ulažite u male biznise i startupe',
  description: 'Platforma za investiranje u provjerene biznise, startupe i projekte. Povežite kapital sa perspektivnim poduzećima. ROI 8–35% godišnje. Prijavite se na listu čekanja.',
  keywords: ['invest', 'investment platform', 'startup investment', 'small business', 'ROI', 'angel investor', 'GigZone Invest'],
  openGraph: {
    title: 'GigZone Invest — Ulažite u male biznise i startupe',
    description: 'Povežite kapital sa provjerenim biznisom. ROI 8–35% godišnje. Prijavite se na listu čekanja.',
    url: 'https://www.gigzone.app/invest',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.gigzone.app/invest',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FinancialService',
  name: 'GigZone Invest',
  description: 'Platforma za investiranje u male biznise, startupe i projekte. Povežite kapital sa provjerenim biznisom uz ROI 8–35% godišnje.',
  url: 'https://www.gigzone.app/invest',
  provider: {
    '@type': 'Organization',
    name: 'GigZone',
    url: 'https://www.gigzone.app',
  },
  areaServed: { '@type': 'Place', name: 'Worldwide' },
  serviceType: 'Investment Platform',
  offers: {
    '@type': 'Offer',
    description: 'Investicije u lokalne biznise i startupe sa ROI 8–35% godišnje',
    availabilityStarts: '2026-01-01',
  },
};

export default function InvestPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <InvestClient />
    </>
  );
}
