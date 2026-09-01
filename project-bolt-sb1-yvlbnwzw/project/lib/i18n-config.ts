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
  feed: {
    sr: {
      title: 'Feed — GigZone',
      description: 'Pratite radove, objave i novosti profesionalaca na GigZone. Povežite se sa freelancerima, kreatorima sadržaja i stručnjacima iz vaše oblasti.',
      keywords: ['feed', 'objave', 'radovi', 'profesionalci', 'freelanceri', 'kreatori sadržaja', 'gigzone'],
    },
    en: {
      title: 'Feed — GigZone',
      description: 'Follow the work, posts and updates of professionals on GigZone. Connect with freelancers, content creators and experts in your field.',
      keywords: ['feed', 'posts', 'work', 'professionals', 'freelancers', 'content creators', 'gigzone'],
    },
    de: {
      title: 'Feed — GigZone',
      description: 'Verfolgen Sie Arbeiten, Beiträge und Neuigkeiten von Fachleuten auf GigZone. Vernetzen Sie sich mit Freelancern, Content Creatorn und Experten.',
      keywords: ['Feed', 'Beiträge', 'Arbeiten', 'Fachleute', 'Freelancer', 'Content Creator', 'gigzone'],
    },
  },
  help: {
    sr: {
      title: 'Pomoć i podrška — GigZone',
      description: 'Pronađite odgovore na česta pitanja o GigZone platformi. Krediti, objave, usluge, poslovi i sve što trebate znati.',
      keywords: ['pomoć', 'podrška', 'FAQ', 'pitanja', 'uputstvo', 'gigzone'],
    },
    en: {
      title: 'Help & Support — GigZone',
      description: 'Find answers to frequently asked questions about GigZone. Credits, posts, services, jobs and everything you need to know.',
      keywords: ['help', 'support', 'FAQ', 'questions', 'guide', 'gigzone'],
    },
    de: {
      title: 'Hilfe & Support — GigZone',
      description: 'Finden Sie Antworten auf häufig gestellte Fragen zu GigZone. Credits, Beiträge, Dienstleistungen, Jobs und alles Wissenswerte.',
      keywords: ['Hilfe', 'Support', 'FAQ', 'Fragen', 'Anleitung', 'gigzone'],
    },
  },
  terms: {
    sr: {
      title: 'Uslovi korišćenja — GigZone',
      description: 'Pročitajte uslove korišćenja GigZone platforme. Pravila i obaveze za korisnike, profesionalce i kompanije.',
      keywords: ['uslovi korišćenja', 'pravila', 'politika', 'gigzone'],
    },
    en: {
      title: 'Terms of Service — GigZone',
      description: 'Read the terms of service for the GigZone platform. Rules and obligations for users, professionals and companies.',
      keywords: ['terms of service', 'rules', 'policy', 'gigzone'],
    },
    de: {
      title: 'Nutzungsbedingungen — GigZone',
      description: 'Lesen Sie die Nutzungsbedingungen der GigZone-Plattform. Regeln und Pflichten für Nutzer, Fachleute und Unternehmen.',
      keywords: ['Nutzungsbedingungen', 'Regeln', 'Richtlinien', 'gigzone'],
    },
  },
  homepage: {
    sr: {
      title: 'GigZone – Globalna platforma za profesionalce, kompanije, usluge i poslove',
      description: 'Globalna platforma za kompanije, usluge, profesionalce, freelancere i kreatore sadržaja. Pronađite posao, zaposlite radnike, ponudite usluge ili predstavite svoj rad na GigZone-u.',
      keywords: ['profesionalci', 'usluge', 'poslovi', 'freelance', 'kreatori sadržaja', 'marketplace', 'gigzone'],
    },
    en: {
      title: 'GigZone – Global Platform for Professionals, Companies, Services & Jobs',
      description: 'Global platform for companies, services, professionals, freelancers and content creators. Find jobs, hire workers, offer services or showcase your work on GigZone.',
      keywords: ['professionals', 'services', 'jobs', 'freelance', 'content creators', 'marketplace', 'gigzone'],
    },
    de: {
      title: 'GigZone – Globale Plattform für Fachkräfte, Unternehmen, Dienstleistungen & Jobs',
      description: 'Globale Plattform für Unternehmen, Dienstleistungen, Fachkräfte, Freelancer und Content Creator. Finden Sie Jobs, Mitarbeiter, bieten Sie Dienstleistungen an oder präsentieren Sie Ihre Arbeit auf GigZone.',
      keywords: ['Fachleute', 'Dienstleistungen', 'Jobs', 'Freelancer', 'Content Creator', 'Marktplatz', 'gigzone'],
    },
  },
  jobs: {
    sr: {
      title: 'Poslovi i zapošljavanje – Pronađite posao ili radnike | GigZone',
      description: 'Pronađite posao ili zaposlite radnike na GigZone-u. Pregledajte oglase za posao po kategorijama i lokacijama i povežite se sa poslodavcima širom sveta.',
      keywords: ['posao', 'zapošljavanje', 'tražim posao', 'tražim radnika', 'oglasi za posao', 'gigzone'],
    },
    de: {
      title: 'Jobs & Mitarbeiter finden – Jobs & Personal | GigZone',
      description: 'Finden Sie Jobs oder Mitarbeiter auf GigZone. Durchsuchen Sie Stellenangebote nach Kategorie und Standort und verbinden Sie sich weltweit mit Arbeitgebern.',
      keywords: ['Job', 'Stellenangebote', 'Arbeit finden', 'Mitarbeiter suchen', 'Jobportal', 'gigzone'],
    },
    en: {
      title: 'Jobs & Hiring – Find Jobs or Hire Workers | GigZone',
      description: 'Find jobs or hire workers on GigZone. Browse job listings by category and location and connect with employers worldwide.',
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
