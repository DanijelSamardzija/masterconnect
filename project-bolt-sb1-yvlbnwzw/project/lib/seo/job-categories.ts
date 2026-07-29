import type { Lang } from '@/lib/i18n-config';
import { CATEGORY_SLUGS, type CategorySlug } from './categories';

type JobCategoryMeta = {
  title: string;
  description: string;
  keywords: string[];
};

export const JOB_CATEGORY_SEO: Record<CategorySlug, Record<Lang, JobCategoryMeta>> = {
  construction: {
    sr: {
      title: 'Posao u građevini i zanatima | GigZone',
      description: 'Oglasi za posao u građevini, zanatima i adaptacijama. Pronađite posao ili objavite oglas za radnike.',
      keywords: ['posao u građevini', 'majstor posao', 'zidar oglas', 'zanati zaposlenje', 'adaptacija radnici', 'gigzone'],
    },
    en: {
      title: 'Construction & Trades Jobs | GigZone',
      description: 'Job listings in construction and skilled trades. Find work or post a job for craftsmen and builders.',
      keywords: ['construction jobs', 'trades jobs', 'builder work', 'craftsman hiring', 'renovation workers', 'gigzone'],
    },
    de: {
      title: 'Jobs in Bau & Handwerk | GigZone',
      description: 'Stellenangebote im Bau- und Handwerksbereich. Arbeit finden oder Handwerker einstellen.',
      keywords: ['Bau Jobs', 'Handwerk Stellen', 'Bauarbeiter gesucht', 'Handwerker Stellenangebote', 'gigzone'],
    },
  },
  home_services: {
    sr: {
      title: 'Posao u kućnim uslugama | GigZone',
      description: 'Oglasi za posao u kućnim uslugama: čišćenje, vodoinstalaterstvo, elektro i opšte popravke.',
      keywords: ['posao kućne usluge', 'vodoinstalater oglas', 'čišćenje posao', 'elektrièar zaposlenje', 'popravke radnici', 'gigzone'],
    },
    en: {
      title: 'Home Services Jobs | GigZone',
      description: 'Job listings in home services: cleaning, plumbing, electrical and general repairs.',
      keywords: ['home services jobs', 'plumber work', 'cleaning job', 'electrician hiring', 'maintenance jobs', 'gigzone'],
    },
    de: {
      title: 'Jobs in Haushaltsdienstleistungen | GigZone',
      description: 'Stellenangebote in Haushaltsdienstleistungen: Reinigung, Klempner, Elektriker und Reparaturen.',
      keywords: ['Haushaltsdienstleistungen Jobs', 'Klempner Stelle', 'Reinigung Arbeit', 'Elektriker gesucht', 'gigzone'],
    },
  },
  it_technology: {
    sr: {
      title: 'IT i tehnologija — posao i zaposlenje | GigZone',
      description: 'IT oglasi za posao — programeri, web dizajneri, sistem administratori i tech support. Pronađite ili objavite oglas.',
      keywords: ['IT posao', 'programer oglas', 'web dizajner zaposlenje', 'tech posao', 'softver radnici', 'gigzone'],
    },
    en: {
      title: 'IT & Technology Jobs | GigZone',
      description: 'IT job listings — developers, web designers, system admins and tech support. Find work or post a job.',
      keywords: ['IT jobs', 'developer jobs', 'web design work', 'tech jobs', 'software hiring', 'gigzone'],
    },
    de: {
      title: 'IT & Technologie Jobs | GigZone',
      description: 'IT-Stellenangebote — Entwickler, Webdesigner, Systemadministratoren und Tech-Support.',
      keywords: ['IT Jobs', 'Entwickler Stelle', 'Webdesign Arbeit', 'Tech Jobs', 'Software gesucht', 'gigzone'],
    },
  },
  health: {
    sr: {
      title: 'Posao u zdravstvu i medicini | GigZone',
      description: 'Oglasi za posao u zdravstvenom sektoru — ljekari, fizioterapeuti, medicinske sestre i zdravstveno osoblje.',
      keywords: ['posao zdravstvo', 'ljekar oglas', 'fizioterapeut zaposlenje', 'medicinska sestra oglas', 'zdravstvo radnici', 'gigzone'],
    },
    en: {
      title: 'Health & Medical Jobs | GigZone',
      description: 'Job listings in health and medicine — doctors, physiotherapists, nurses and medical staff.',
      keywords: ['health jobs', 'medical jobs', 'doctor hiring', 'physiotherapist work', 'nursing jobs', 'gigzone'],
    },
    de: {
      title: 'Gesundheit & Medizin Jobs | GigZone',
      description: 'Stellenangebote im Gesundheitswesen — Ärzte, Physiotherapeuten, Pflegepersonal und Medizinexperten.',
      keywords: ['Gesundheit Jobs', 'Arzt Stelle', 'Physiotherapeut Arbeit', 'Pflegepersonal gesucht', 'gigzone'],
    },
  },
  finance: {
    sr: {
      title: 'Posao u finansijama i računovodstvu | GigZone',
      description: 'Oglasi za posao u finansijama — računovođe, poreske savjetnike i finansijske analitičare.',
      keywords: ['računovođa oglas', 'finansije posao', 'poreski savjetnik zaposlenje', 'računovodstvo radnici', 'gigzone'],
    },
    en: {
      title: 'Finance & Accounting Jobs | GigZone',
      description: 'Job listings in finance — accountants, tax advisors and financial analysts.',
      keywords: ['finance jobs', 'accounting jobs', 'accountant hiring', 'tax advisor work', 'financial analyst', 'gigzone'],
    },
    de: {
      title: 'Finanzen & Buchhaltung Jobs | GigZone',
      description: 'Stellenangebote in Finanzen und Buchhaltung — Buchhalter, Steuerberater und Finanzanalysten.',
      keywords: ['Finanzen Jobs', 'Buchhaltung Stelle', 'Buchhalter gesucht', 'Steuerberater Arbeit', 'gigzone'],
    },
  },
  beauty: {
    sr: {
      title: 'Posao u ljepoti i wellnessu | GigZone',
      description: 'Oglasi za posao u beauty sektoru — frizeri, kozmetičari, masažni terapeuti i spa profesionalci.',
      keywords: ['frizer posao', 'kozmetičar oglas', 'masaža zaposlenje', 'wellness radnici', 'beauty posao', 'gigzone'],
    },
    en: {
      title: 'Beauty & Wellness Jobs | GigZone',
      description: 'Job listings in beauty and wellness — hairdressers, beauticians, massage therapists and spa professionals.',
      keywords: ['beauty jobs', 'hairdresser work', 'beautician hiring', 'massage therapist jobs', 'spa jobs', 'gigzone'],
    },
    de: {
      title: 'Schönheit & Wellness Jobs | GigZone',
      description: 'Stellenangebote in Schönheit und Wellness — Friseure, Kosmetiker, Massagetherapeuten und Spa-Profis.',
      keywords: ['Schönheit Jobs', 'Friseur Stelle', 'Kosmetiker gesucht', 'Massagetherapeut Arbeit', 'gigzone'],
    },
  },
  security: {
    sr: {
      title: 'Posao u bezbjednosti i zaštiti | GigZone',
      description: 'Oglasi za posao u bezbjednosti — zaštitari, video nadzor, alarmni sistemi i cybersigurnost.',
      keywords: ['zaštitar oglas', 'bezbjednost posao', 'video nadzor zaposlenje', 'security radnici', 'gigzone'],
    },
    en: {
      title: 'Security Jobs | GigZone',
      description: 'Job listings in security — security guards, CCTV operators, alarm technicians and cybersecurity professionals.',
      keywords: ['security jobs', 'security guard work', 'CCTV jobs', 'alarm technician hiring', 'cybersecurity jobs', 'gigzone'],
    },
    de: {
      title: 'Sicherheit Jobs | GigZone',
      description: 'Stellenangebote im Sicherheitsbereich — Wachpersonal, Videoüberwachung und Alarmanlagen.',
      keywords: ['Sicherheit Jobs', 'Wachpersonal Stelle', 'Videoüberwachung Arbeit', 'Sicherheitstechniker gesucht', 'gigzone'],
    },
  },
  education: {
    sr: {
      title: 'Posao u obrazovanju i obuci | GigZone',
      description: 'Oglasi za posao u obrazovanju — nastavnici, instruktori, privatni učitelji i treneri.',
      keywords: ['nastavnik oglas', 'instruktor posao', 'privatni čas posao', 'obrazovanje zaposlenje', 'trener oglas', 'gigzone'],
    },
    en: {
      title: 'Education & Teaching Jobs | GigZone',
      description: 'Job listings in education — teachers, instructors, tutors and trainers.',
      keywords: ['teaching jobs', 'tutor work', 'instructor hiring', 'education jobs', 'training jobs', 'gigzone'],
    },
    de: {
      title: 'Bildung & Unterricht Jobs | GigZone',
      description: 'Stellenangebote in Bildung und Unterricht — Lehrer, Tutoren, Instruktoren und Trainer.',
      keywords: ['Bildung Jobs', 'Lehrer Stelle', 'Nachhilfe Arbeit', 'Instruktor gesucht', 'Trainer Jobs', 'gigzone'],
    },
  },
  transport: {
    sr: {
      title: 'Posao u transportu i dostavi | GigZone',
      description: 'Oglasi za posao u transportu — vozači, dostavIjači, kuriri i selidbe.',
      keywords: ['vozač oglas', 'transport posao', 'dostava zaposlenje', 'kurir oglas', 'selidba radnici', 'gigzone'],
    },
    en: {
      title: 'Transport & Delivery Jobs | GigZone',
      description: 'Job listings in transport and delivery — drivers, couriers, movers and logistics workers.',
      keywords: ['driver jobs', 'delivery work', 'courier hiring', 'transport jobs', 'logistics jobs', 'gigzone'],
    },
    de: {
      title: 'Transport & Lieferung Jobs | GigZone',
      description: 'Stellenangebote in Transport und Lieferung — Fahrer, Kuriere, Umzugshelfer und Logistiker.',
      keywords: ['Fahrer Jobs', 'Lieferung Stelle', 'Kurier Arbeit', 'Transport gesucht', 'Logistik Jobs', 'gigzone'],
    },
  },
  food: {
    sr: {
      title: 'Posao u ugostiteljstvu i prehrani | GigZone',
      description: 'Oglasi za posao u ugostiteljstvu — kuvari, konobari, ketering i prehrambena industrija.',
      keywords: ['kuvar oglas', 'konobar posao', 'ketering zaposlenje', 'ugostiteljstvo radnici', 'restoran oglas', 'gigzone'],
    },
    en: {
      title: 'Food & Hospitality Jobs | GigZone',
      description: 'Job listings in food and hospitality — chefs, waiters, catering and food industry workers.',
      keywords: ['chef jobs', 'waiter work', 'catering hiring', 'hospitality jobs', 'restaurant jobs', 'gigzone'],
    },
    de: {
      title: 'Gastronomie & Lebensmittel Jobs | GigZone',
      description: 'Stellenangebote in Gastronomie — Köche, Kellner, Catering und Lebensmittelindustrie.',
      keywords: ['Koch Jobs', 'Kellner Stelle', 'Catering Arbeit', 'Gastronomie gesucht', 'Restaurant Jobs', 'gigzone'],
    },
  },
  marketing: {
    sr: {
      title: 'Posao u marketingu i reklamiranju | GigZone',
      description: 'Oglasi za posao u marketingu — grafički dizajneri, copywriteri, SEO eksperti i social media menadžeri.',
      keywords: ['marketing posao', 'dizajner oglas', 'copywriter zaposlenje', 'SEO posao', 'social media radnici', 'gigzone'],
    },
    en: {
      title: 'Marketing & Advertising Jobs | GigZone',
      description: 'Job listings in marketing — graphic designers, copywriters, SEO experts and social media managers.',
      keywords: ['marketing jobs', 'designer work', 'copywriter hiring', 'SEO jobs', 'social media jobs', 'gigzone'],
    },
    de: {
      title: 'Marketing & Werbung Jobs | GigZone',
      description: 'Stellenangebote in Marketing und Werbung — Grafikdesigner, Texter, SEO-Experten und Social-Media-Manager.',
      keywords: ['Marketing Jobs', 'Designer Stelle', 'Texter Arbeit', 'SEO Jobs', 'Social Media gesucht', 'gigzone'],
    },
  },
  legal: {
    sr: {
      title: 'Posao u pravu i konsaltingu | GigZone',
      description: 'Oglasi za posao u pravu — advokati, pravni savjetnici i konsultanti za poslovne i privatne potrebe.',
      keywords: ['advokat oglas', 'pravni posao', 'pravo zaposlenje', 'konsalting radnici', 'pravne usluge oglas', 'gigzone'],
    },
    en: {
      title: 'Legal & Consulting Jobs | GigZone',
      description: 'Job listings in legal and consulting — lawyers, legal advisors and business consultants.',
      keywords: ['legal jobs', 'lawyer work', 'attorney hiring', 'consulting jobs', 'legal advisor jobs', 'gigzone'],
    },
    de: {
      title: 'Recht & Beratung Jobs | GigZone',
      description: 'Stellenangebote in Recht und Beratung — Anwälte, Rechtsberater und Unternehmensberater.',
      keywords: ['Recht Jobs', 'Anwalt Stelle', 'Rechtsberater Arbeit', 'Beratung gesucht', 'Jurist Jobs', 'gigzone'],
    },
  },
  real_estate: {
    sr: {
      title: 'Posao u nekretninama | GigZone',
      description: 'Oglasi za posao u sektoru nekretnina — agenti, procjenitelji i menadžeri imovine.',
      keywords: ['agent nekretnina oglas', 'nekretnine posao', 'procjenitelj zaposlenje', 'imovina menadžer oglas', 'gigzone'],
    },
    en: {
      title: 'Real Estate Jobs | GigZone',
      description: 'Job listings in real estate — agents, appraisers and property managers.',
      keywords: ['real estate jobs', 'estate agent work', 'property manager hiring', 'appraiser jobs', 'gigzone'],
    },
    de: {
      title: 'Immobilien Jobs | GigZone',
      description: 'Stellenangebote in der Immobilienbranche — Makler, Gutachter und Immobilienverwalter.',
      keywords: ['Immobilien Jobs', 'Makler Stelle', 'Gutachter Arbeit', 'Immobilienverwalter gesucht', 'gigzone'],
    },
  },
  other: {
    sr: {
      title: 'Razni oglasi za posao | GigZone',
      description: 'Oglasi za posao koji ne spadaju u standardne kategorije. Pronađite angažman ili zaposlite radnike.',
      keywords: ['razni poslovi', 'oglas za posao', 'freelance oglas', 'angažman', 'zaposlenje gigzone'],
    },
    en: {
      title: 'Other Job Listings | GigZone',
      description: 'Job listings that don\'t fit standard categories. Find work or post a job for various roles.',
      keywords: ['other jobs', 'miscellaneous work', 'freelance jobs', 'job listings', 'gigzone'],
    },
    de: {
      title: 'Sonstige Stellenangebote | GigZone',
      description: 'Stellenangebote, die nicht in Standardkategorien passen. Arbeit finden oder Mitarbeiter einstellen.',
      keywords: ['Sonstige Jobs', 'verschiedene Stellen', 'Freelance Arbeit', 'Stellenangebote', 'gigzone'],
    },
  },
};

// Re-export so callers only need one import for jobs SEO.
export { CATEGORY_SLUGS, isValidCategory, getCategoryLabel, type CategorySlug } from './categories';
