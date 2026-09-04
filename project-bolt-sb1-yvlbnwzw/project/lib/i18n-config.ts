export const SUPPORTED_LANGS = ['sr', 'en', 'de', 'es', 'fr'] as const;
export type Lang = 'sr' | 'en' | 'de' | 'es' | 'fr';
export const DEFAULT_LANG: Lang = 'en';

const SR_PREFIXES = ['sr', 'hr', 'bs', 'sh', 'cnr', 'sl', 'mk', 'hbs'];
const DE_PREFIXES = ['de', 'gsw', 'bar'];
const ES_PREFIXES = ['es'];
const FR_PREFIXES = ['fr'];

export function detectLang(acceptLanguage: string): Lang {
  const languages = acceptLanguage
    .split(',')
    .map((l) => l.split(';')[0].trim().toLowerCase());

  for (const lang of languages) {
    const primary = lang.split('-')[0];
    if (DE_PREFIXES.includes(primary)) return 'de';
    if (SR_PREFIXES.includes(primary)) return 'sr';
    if (ES_PREFIXES.includes(primary)) return 'es';
    if (FR_PREFIXES.includes(primary)) return 'fr';
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
    es: {
      title: 'Feed — GigZone',
      description: 'Sigue el trabajo, publicaciones y novedades de profesionales en GigZone. Conéctate con freelancers, creadores de contenido y expertos en tu campo.',
      keywords: ['feed', 'publicaciones', 'trabajo', 'profesionales', 'freelancers', 'creadores de contenido', 'gigzone'],
    },
    fr: {
      title: 'Feed — GigZone',
      description: 'Suivez les travaux, publications et actualités des professionnels sur GigZone. Connectez-vous avec des freelances, créateurs de contenu et experts.',
      keywords: ['feed', 'publications', 'travaux', 'professionnels', 'freelances', 'créateurs de contenu', 'gigzone'],
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
    es: {
      title: 'Ayuda y Soporte — GigZone',
      description: 'Encuentra respuestas a preguntas frecuentes sobre GigZone. Créditos, publicaciones, servicios, empleos y todo lo que necesitas saber.',
      keywords: ['ayuda', 'soporte', 'FAQ', 'preguntas', 'guía', 'gigzone'],
    },
    fr: {
      title: 'Aide & Support — GigZone',
      description: 'Trouvez des réponses aux questions fréquemment posées sur GigZone. Crédits, publications, services, emplois et tout ce que vous devez savoir.',
      keywords: ['aide', 'support', 'FAQ', 'questions', 'guide', 'gigzone'],
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
    es: {
      title: 'Términos de servicio — GigZone',
      description: 'Lee los términos de servicio de la plataforma GigZone. Reglas y obligaciones para usuarios, profesionales y empresas.',
      keywords: ['términos de servicio', 'reglas', 'política', 'gigzone'],
    },
    fr: {
      title: 'Conditions d\'utilisation — GigZone',
      description: 'Lisez les conditions d\'utilisation de la plateforme GigZone. Règles et obligations pour les utilisateurs, professionnels et entreprises.',
      keywords: ['conditions d\'utilisation', 'règles', 'politique', 'gigzone'],
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
    es: {
      title: 'GigZone – Plataforma Global para Profesionales, Empresas, Servicios y Empleo',
      description: 'Plataforma global para empresas, servicios, profesionales, freelancers y creadores de contenido. Encuentra empleo, contrata trabajadores, ofrece servicios o muestra tu trabajo en GigZone.',
      keywords: ['profesionales', 'servicios', 'empleos', 'freelance', 'creadores de contenido', 'marketplace', 'gigzone'],
    },
    fr: {
      title: 'GigZone – Plateforme Mondiale pour Professionnels, Entreprises, Services & Emplois',
      description: 'Plateforme mondiale pour entreprises, services, professionnels, freelances et créateurs de contenu. Trouvez un emploi, embauchez des travailleurs, proposez des services ou présentez votre travail sur GigZone.',
      keywords: ['professionnels', 'services', 'emplois', 'freelance', 'créateurs de contenu', 'marketplace', 'gigzone'],
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
    es: {
      title: 'Empleos & Contratación – Encuentra Empleo o Contrata Trabajadores | GigZone',
      description: 'Encuentra empleo o contrata trabajadores en GigZone. Navega ofertas de empleo por categoría y ubicación y conéctate con empleadores de todo el mundo.',
      keywords: ['empleos', 'trabajo', 'buscar empleo', 'contratar trabajadores', 'ofertas de trabajo', 'gigzone'],
    },
    fr: {
      title: 'Emplois & Recrutement – Trouvez un emploi ou Recrutez | GigZone',
      description: 'Trouvez un emploi ou recrutez des travailleurs sur GigZone. Parcourez les offres d\'emploi par catégorie et localisation et connectez-vous avec des employeurs dans le monde entier.',
      keywords: ['emplois', 'recrutement', 'trouver un emploi', 'embaucher', 'offres d\'emploi', 'gigzone'],
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
    es: {
      title: 'Encontrar Trabajadores Cualificados y Profesionales — GigZone',
      description: 'Encuentra fontaneros, electricistas, expertos en IT y otros profesionales cualificados. Rápido, fácil, fiable.',
      keywords: ['trabajadores cualificados', 'profesionales', 'electricista', 'servicios IT', 'freelance', 'gigzone'],
    },
    fr: {
      title: 'Trouver des Travailleurs Qualifiés & Professionnels — GigZone',
      description: 'Trouvez des plombiers, électriciens, experts IT et autres professionnels qualifiés. Rapide, facile, fiable.',
      keywords: ['travailleurs qualifiés', 'professionnels', 'électricien', 'services IT', 'freelance', 'gigzone'],
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
    es: {
      title: 'GigZone Invest — Invierte en Pequeñas Empresas y Startups',
      description: 'Plataforma de inversión para empresas y startups verificadas. ROI 8–35% anual. Únete a la lista de espera.',
      keywords: ['inversión', 'pequeña empresa', 'startup', 'ROI', 'inversor ángel', 'GigZone Invest'],
    },
    fr: {
      title: 'GigZone Invest — Investissez dans les PME & Startups',
      description: 'Plateforme d\'investissement pour entreprises et startups vérifiées. ROI 8–35% annuellement. Rejoignez la liste d\'attente.',
      keywords: ['investissement', 'petite entreprise', 'startup', 'ROI', 'business angel', 'GigZone Invest'],
    },
  },
} satisfies Record<string, Record<Lang, { title: string; description: string; keywords: string[] }>>;

export const BASE_URL = 'https://www.gigzone.app';

export function hreflang(path: string) {
  return {
    sr: `${BASE_URL}/sr${path}`,
    de: `${BASE_URL}/de${path}`,
    en: `${BASE_URL}/en${path}`,
    es: `${BASE_URL}/es${path}`,
    fr: `${BASE_URL}/fr${path}`,
    'x-default': `${BASE_URL}/en${path}`,
  };
}
