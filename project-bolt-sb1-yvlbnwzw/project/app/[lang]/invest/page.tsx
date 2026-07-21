import { InvestClient } from '@/app/invest/invest-client';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FinancialService',
  '@id': 'https://www.gigzone.app/invest#financialservice',
  name: 'GigZone Invest',
  description: 'Platforma za investiranje u provjerene biznise, startupe i projekte. Povežite kapital sa perspektivnim poduzećima. ROI 8–35% godišnje.',
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
    validFrom: '2026-01-01',
  },
};

export default function LangInvestPage() {
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
