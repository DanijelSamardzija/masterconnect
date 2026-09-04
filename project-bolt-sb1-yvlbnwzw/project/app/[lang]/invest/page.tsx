import type { Lang } from '@/lib/i18n-config';
import { InvestClient } from '@/app/invest/invest-client';

const INVEST_DESCRIPTIONS: Record<Lang, { main: string; offer: string }> = {
  sr: {
    main: 'Platforma za investiranje u provjerene biznise, startupe i projekte. Povežite kapital sa perspektivnim poduzećima. ROI 8–35% godišnje.',
    offer: 'Investicije u lokalne biznise i startupe sa ROI 8–35% godišnje',
  },
  en: {
    main: 'Investment platform for verified businesses, startups and projects. Connect capital with promising companies. ROI 8–35% per year.',
    offer: 'Investments in local businesses and startups with ROI 8–35% per year',
  },
  de: {
    main: 'Investitionsplattform für geprüfte Unternehmen, Startups und Projekte. Verbinden Sie Kapital mit vielversprechenden Firmen. ROI 8–35% jährlich.',
    offer: 'Investitionen in lokale Unternehmen und Startups mit ROI 8–35% jährlich',
  },
  es: {
    main: 'Plataforma de inversión en negocios verificados, startups y proyectos. Conecta capital con empresas prometedoras. ROI 8–35% anual.',
    offer: 'Inversiones en negocios locales y startups con ROI 8–35% anual',
  },
  fr: {
    main: "Plateforme d'investissement dans des entreprises vérifiées, startups et projets. Connectez capital et sociétés prometteuses. ROI 8–35 % par an.",
    offer: "Investissements dans des entreprises locales et startups avec ROI 8–35 % par an",
  },
};

export default function LangInvestPage({ params }: { params: { lang: Lang } }) {
  const d = INVEST_DESCRIPTIONS[params.lang] ?? INVEST_DESCRIPTIONS.en;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': 'https://www.gigzone.app/invest#financialservice',
    name: 'GigZone Invest',
    description: d.main,
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
      description: d.offer,
      validFrom: '2026-01-01',
    },
  };

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
