export const SUPPORTED_LANGS = ['sr', 'en', 'de'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

const SR_PREFIXES = ['sr', 'hr', 'bs', 'sh', 'cnr', 'sl', 'mk', 'hbs'];
const DE_PREFIXES = ['de', 'gsw', 'bar'];

export function detectLang(acceptLanguage: string): Lang {
  const languages = acceptLanguage
    .split(',')
    .map((l) => l.split(';')[0].trim().toLowerCase());

  for (const lang of languages) {
    const primary = lang.split('-')[0];
    if (DE_PREFIXES.includes(primary)) return 'de';
    if (SR_PREFIXES.includes(primary)) return 'sr';
  }
  return DEFAULT_LANG;
}

export const pageMeta = {
  homepage: {
    sr: {
      title: 'GigZone – Platforma za profesionalce, usluge i poslove',
      description: 'Objavite posao, pronađite profesionalce, ponudite usluge ili predstavite svoj rad. GigZone povezuje firme, freelancere, kreatore sadržaja i korisnike na jednom mjestu.',
      keywords: ['profesionalci', 'usluge', 'poslovi', 'freelance', 'kreatori sadržaja', 'marketplace', 'gigzone'],
    },
    en: {
      title: 'GigZone – Platform for Professionals, Services & Jobs',
      description: 'Post a job, find professionals, offer services or showcase your work. GigZone connects businesses, freelancers, content creators and users in one place.',
      keywords: ['professionals', 'services', 'jobs', 'freelance', 'content creators', 'marketplace', 'gigzone'],
    },
    de: {
      title: 'GigZone – Plattform für Fachleute, Dienstleistungen & Jobs',
      description: 'Job inserieren, Fachleute finden, Dienstleistungen anbieten oder Ihre Arbeit präsentieren. GigZone verbindet Unternehmen, Freelancer, Content Creator und Nutzer auf einer Plattform.',
      keywords: ['Fachleute', 'Dienstleistungen', 'Jobs', 'Freelancer', 'Content Creator', 'Marktplatz', 'gigzone'],
    },
  },
  jobs: {
    sr: {
      title: 'Poslovi i zapošljavanje — GigZone',
      description: 'Pronađite posao ili zaposlite radnike. Hiljade oglasa na jednom mjestu.',
      keywords: ['posao', 'zapošljavanje', 'tražim posao', 'tražim radnika', 'oglasi za posao', 'gigzone'],
    },
    de: {
      title: 'Jobs & Stellenangebote — GigZone',
      description: 'Finden Sie einen Job oder stellen Sie Mitarbeiter ein. Tausende Stellenangebote auf einer Plattform.',
      keywords: ['Job', 'Stellenangebote', 'Arbeit finden', 'Mitarbeiter suchen', 'Jobportal', 'gigzone'],
    },
    en: {
      title: 'Jobs & Employment — GigZone',
      description: 'Find a job or hire workers. Thousands of job listings on one platform.',
      keywords: ['jobs', 'employment', 'find work', 'hire workers', 'job listings', 'gigzone'],
    },
  },
  services: {
    sr: {
      title: 'Usluge majstora i profesionalaca — GigZone',
      description: 'Pronađite majstore, vodoinstalaere, električare, IT stručnjake i druge profesionalce. Brzo, jednostavno, pouzdano.',
      keywords: ['majstor', 'usluge', 'vodoinstalater', 'električar', 'IT usluge', 'profesionalci', 'gigzone'],
    },
    de: {
      title: 'Handwerker & Fachleute finden — GigZone',
      description: 'Finden Sie Handwerker, Elektriker, IT-Experten und andere Fachleute. Schnell, einfach, zuverlässig.',
      keywords: ['Handwerker', 'Elektriker', 'IT-Experten', 'Fachleute', 'Dienstleistungen', 'gigzone'],
    },
    en: {
      title: 'Find Skilled Workers & Professionals — GigZone',
      description: 'Find plumbers, electricians, IT experts and other skilled professionals. Fast, easy, reliable.',
      keywords: ['skilled workers', 'professionals', 'electrician', 'IT services', 'freelance', 'gigzone'],
    },
  },
  invest: {
    sr: {
      title: 'GigZone Invest — Ulažite u male biznise i startupe',
      description: 'Platforma za investiranje u provjerene biznise i startupe. ROI 8–35% godišnje. Prijavite se na listu čekanja.',
      keywords: ['investicija', 'mali biznis', 'startup', 'ROI', 'angel investor', 'GigZone Invest'],
    },
    de: {
      title: 'GigZone Invest — In kleine Unternehmen & Startups investieren',
      description: 'Investitionsplattform für geprüfte Unternehmen und Startups. ROI 8–35% jährlich. Jetzt auf die Warteliste eintragen.',
      keywords: ['Investition', 'Startup', 'Kleinunternehmen', 'ROI', 'Angel Investor', 'GigZone Invest'],
    },
    en: {
      title: 'GigZone Invest — Invest in Small Businesses & Startups',
      description: 'Investment platform for vetted businesses and startups. ROI 8–35% annually. Join the waiting list.',
      keywords: ['investment', 'small business', 'startup', 'ROI', 'angel investor', 'GigZone Invest'],
    },
  },
} satisfies Record<string, Record<Lang, { title: string; description: string; keywords: string[] }>>;

export const BASE_URL = 'https://www.gigzone.app';

export function hreflang(path: string) {
  return {
    sr: `${BASE_URL}/sr${path}`,
    de: `${BASE_URL}/de${path}`,
    en: `${BASE_URL}/en${path}`,
    'x-default': `${BASE_URL}/en${path}`,
  };
}
