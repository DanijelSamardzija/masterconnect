import { Metadata } from 'next';
import { InvestClient } from './invest-client';

export const metadata: Metadata = {
  title: 'GigZone Invest — Ulažite u male biznise i startupe iz regiona',
  description: 'Platforma za investiranje u provjerene lokalne biznise, startupe i projekte iz Srbije, Hrvatske i dijaspore. ROI 8–35% godišnje. Prijavite se na listu čekanja.',
  keywords: ['investicija Srbija', 'ulaganje mali biznis', 'startup investicija', 'ROI Beograd', 'investicioni projekti dijaspora', 'GigZone Invest'],
  openGraph: {
    title: 'GigZone Invest — Ulažite u male biznise i startupe',
    description: 'Povežite kapital sa provjerenim lokalnim biznisom. ROI 8–35% godišnje. Projekti iz Srbije, Hrvatske, BiH i dijaspore.',
    url: 'https://gigzone.app/invest',
    type: 'website',
  },
  alternates: {
    canonical: 'https://gigzone.app/invest',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FinancialService',
  name: 'GigZone Invest',
  description: 'Platforma za investiranje u male biznise, startupe i projekte iz Srbije i dijaspore. Povežite kapital sa provjerenim lokalnim biznisom uz ROI 8–35% godišnje.',
  url: 'https://gigzone.app/invest',
  provider: {
    '@type': 'Organization',
    name: 'GigZone',
    url: 'https://gigzone.app',
  },
  areaServed: [
    { '@type': 'Country', name: 'Serbia' },
    { '@type': 'Country', name: 'Croatia' },
    { '@type': 'Country', name: 'Bosnia and Herzegovina' },
    { '@type': 'Country', name: 'Germany' },
    { '@type': 'Country', name: 'Austria' },
  ],
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
