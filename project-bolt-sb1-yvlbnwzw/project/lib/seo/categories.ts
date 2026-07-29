import type { Lang } from '@/lib/i18n-config';

export const CATEGORY_SLUGS = [
  'construction',
  'home_services',
  'it_technology',
  'health',
  'finance',
  'beauty',
  'security',
  'education',
  'transport',
  'food',
  'marketing',
  'legal',
  'real_estate',
  'other',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export function isValidCategory(slug: string): slug is CategorySlug {
  return (CATEGORY_SLUGS as readonly string[]).includes(slug);
}

type CategoryMeta = {
  title: string;
  description: string;
  keywords: string[];
};

export const CATEGORY_SEO: Record<CategorySlug, Record<Lang, CategoryMeta>> = {
  construction: {
    sr: {
      title: 'Građevina i zanati — majstori i stručnjaci | GigZone',
      description: 'Pronađite provjerene majstore za građevinske radove, zanate i adaptacije. Besplatno, bez posrednika.',
      keywords: ['majstor', 'građevina', 'zanati', 'adaptacija', 'rekonstrukcija', 'gigzone'],
    },
    en: {
      title: 'Construction & Crafts — Skilled Workers | GigZone',
      description: 'Find verified construction workers and craftsmen for your project. Free, no middlemen.',
      keywords: ['construction', 'crafts', 'builder', 'renovation', 'contractor', 'gigzone'],
    },
    de: {
      title: 'Bau & Handwerk — Fachkräfte finden | GigZone',
      description: 'Finden Sie geprüfte Handwerker für Bau, Renovierung und Sanierung. Kostenlos, ohne Vermittler.',
      keywords: ['Handwerk', 'Bau', 'Renovierung', 'Fachkraft', 'Bauarbeiter', 'gigzone'],
    },
  },
  home_services: {
    sr: {
      title: 'Kućne usluge — čišćenje, popravke, održavanje | GigZone',
      description: 'Pronađite stručnjake za kućne usluge: čišćenje, popravke, vodoinstalaterstvo, elektro i više.',
      keywords: ['kućne usluge', 'čišćenje', 'vodoinstalater', 'elektrièar', 'popravke', 'gigzone'],
    },
    en: {
      title: 'Home Services — Cleaning, Repairs & Maintenance | GigZone',
      description: 'Find experts for home services: cleaning, repairs, plumbing, electrical and more.',
      keywords: ['home services', 'cleaning', 'plumber', 'electrician', 'repairs', 'gigzone'],
    },
    de: {
      title: 'Haushaltsdienstleistungen — Reinigung, Reparaturen | GigZone',
      description: 'Finden Sie Experten für Haushaltsdienstleistungen: Reinigung, Reparaturen, Klempner und mehr.',
      keywords: ['Haushaltsdienstleistungen', 'Reinigung', 'Klempner', 'Elektriker', 'Reparatur', 'gigzone'],
    },
  },
  it_technology: {
    sr: {
      title: 'IT i tehnologija — programeri, web dizajn, podrška | GigZone',
      description: 'Pronađite IT stručnjake za razvoj softvera, web dizajn, mrežu i tehničku podršku.',
      keywords: ['IT', 'programer', 'web dizajn', 'softver', 'tehnièka podrška', 'gigzone'],
    },
    en: {
      title: 'IT & Technology — Developers, Web Design & Support | GigZone',
      description: 'Find IT experts for software development, web design, networking and technical support.',
      keywords: ['IT', 'developer', 'web design', 'software', 'tech support', 'gigzone'],
    },
    de: {
      title: 'IT & Technologie — Entwickler, Webdesign & Support | GigZone',
      description: 'Finden Sie IT-Experten für Softwareentwicklung, Webdesign, Netzwerk und technischen Support.',
      keywords: ['IT', 'Entwickler', 'Webdesign', 'Software', 'IT-Support', 'gigzone'],
    },
  },
  health: {
    sr: {
      title: 'Zdravstvo i medicina — ljekar, terapeut, njega | GigZone',
      description: 'Pronađite zdravstvene stručnjake: liječnike, fizioterapeute, psihologe i medicinsko osoblje.',
      keywords: ['zdravstvo', 'ljekar', 'fizioterapeut', 'psiholog', 'medicinska njega', 'gigzone'],
    },
    en: {
      title: 'Health & Medical — Doctors, Therapists & Care | GigZone',
      description: 'Find health professionals: doctors, physiotherapists, psychologists and medical staff.',
      keywords: ['health', 'doctor', 'physiotherapist', 'psychologist', 'medical care', 'gigzone'],
    },
    de: {
      title: 'Gesundheit & Medizin — Ärzte, Therapeuten & Pflege | GigZone',
      description: 'Finden Sie Gesundheitsfachkräfte: Ärzte, Physiotherapeuten, Psychologen und Pflegepersonal.',
      keywords: ['Gesundheit', 'Arzt', 'Physiotherapeut', 'Psychologe', 'Pflege', 'gigzone'],
    },
  },
  finance: {
    sr: {
      title: 'Finansije i računovodstvo — računovođa, poreski savjetnik | GigZone',
      description: 'Pronađite finansijske stručnjake: računovođe, poreske savjetnike i finansijske analitičare.',
      keywords: ['računovodstvo', 'računovođa', 'poreski savjetnik', 'finansije', 'bookkeeping', 'gigzone'],
    },
    en: {
      title: 'Finance & Accounting — Accountants & Advisors | GigZone',
      description: 'Find financial experts: accountants, tax advisors and financial analysts.',
      keywords: ['accounting', 'accountant', 'tax advisor', 'finance', 'bookkeeping', 'gigzone'],
    },
    de: {
      title: 'Finanzen & Buchhaltung — Buchhalter & Berater | GigZone',
      description: 'Finden Sie Finanzexperten: Buchhalter, Steuerberater und Finanzanalysten.',
      keywords: ['Buchhaltung', 'Buchhalter', 'Steuerberater', 'Finanzen', 'gigzone'],
    },
  },
  beauty: {
    sr: {
      title: 'Ljepota i wellness — frizer, kozmetičar, masaža | GigZone',
      description: 'Pronađite stručnjake za ljepotu i wellness: frizerske usluge, kozmetiku, masažu i spa tretmane.',
      keywords: ['frizer', 'kozmetièar', 'masaža', 'wellness', 'spa', 'gigzone'],
    },
    en: {
      title: 'Beauty & Wellness — Hairdresser, Beautician & Massage | GigZone',
      description: 'Find beauty and wellness experts: hairdressers, beauticians, massage and spa treatments.',
      keywords: ['hairdresser', 'beautician', 'massage', 'wellness', 'spa', 'gigzone'],
    },
    de: {
      title: 'Schönheit & Wellness — Friseur, Kosmetik & Massage | GigZone',
      description: 'Finden Sie Schönheits- und Wellnessexperten: Friseure, Kosmetiker, Massage und Spa-Behandlungen.',
      keywords: ['Friseur', 'Kosmetiker', 'Massage', 'Wellness', 'Spa', 'gigzone'],
    },
  },
  security: {
    sr: {
      title: 'Bezbjednost — zaštitar, video nadzor, alarm | GigZone',
      description: 'Pronađite stručnjake za fizièku zaštitu, video nadzor, alarmne sisteme i cybersigurnost.',
      keywords: ['zaštitar', 'video nadzor', 'alarm', 'fizièka zaštita', 'cybersigurnost', 'gigzone'],
    },
    en: {
      title: 'Security — Guards, CCTV & Alarm Systems | GigZone',
      description: 'Find security professionals for physical protection, CCTV, alarm systems and cybersecurity.',
      keywords: ['security guard', 'CCTV', 'alarm', 'physical security', 'cybersecurity', 'gigzone'],
    },
    de: {
      title: 'Sicherheit — Wachpersonal, Videoüberwachung & Alarmanlagen | GigZone',
      description: 'Finden Sie Sicherheitsfachkräfte für Personenschutz, Videoüberwachung und Alarmsysteme.',
      keywords: ['Wachpersonal', 'Videoüberwachung', 'Alarmsystem', 'Sicherheit', 'gigzone'],
    },
  },
  education: {
    sr: {
      title: 'Obrazovanje — privatni čas, instruktor, trener | GigZone',
      description: 'Pronađite nastavnike i instruktore za privatne èasove, online uèenje i obuke.',
      keywords: ['privatni èas', 'instruktor', 'nastavnik', 'online uèenje', 'obuka', 'gigzone'],
    },
    en: {
      title: 'Education — Private Lessons, Tutoring & Coaching | GigZone',
      description: 'Find teachers and instructors for private lessons, online learning and training.',
      keywords: ['private lessons', 'tutor', 'teacher', 'online learning', 'training', 'gigzone'],
    },
    de: {
      title: 'Bildung — Privatunterricht, Nachhilfe & Coaching | GigZone',
      description: 'Finden Sie Lehrer und Instruktoren für Privatunterricht, Online-Lernen und Schulungen.',
      keywords: ['Privatunterricht', 'Nachhilfe', 'Lehrer', 'Online-Lernen', 'Coaching', 'gigzone'],
    },
  },
  transport: {
    sr: {
      title: 'Transport i dostava — vozaè, selidba, kurirska služba | GigZone',
      description: 'Pronađite vozaèe i dostavljaèe za selidbe, kurirske usluge i transport robe.',
      keywords: ['transport', 'dostava', 'vozaè', 'selidba', 'kurirska služba', 'gigzone'],
    },
    en: {
      title: 'Transport & Delivery — Drivers, Moving & Courier | GigZone',
      description: 'Find drivers and couriers for moving, delivery services and goods transport.',
      keywords: ['transport', 'delivery', 'driver', 'moving', 'courier', 'gigzone'],
    },
    de: {
      title: 'Transport & Lieferung — Fahrer, Umzug & Kurier | GigZone',
      description: 'Finden Sie Fahrer und Kuriere für Umzüge, Lieferungen und Gütertransport.',
      keywords: ['Transport', 'Lieferung', 'Fahrer', 'Umzug', 'Kurierdienst', 'gigzone'],
    },
  },
  food: {
    sr: {
      title: 'Ugostiteljstvo — kuvar, konobar, ketering | GigZone',
      description: 'Pronađite stručnjake za ugostiteljstvo: kuvare, konobara, ketering i prehrambenu industriju.',
      keywords: ['ugostiteljstvo', 'kuvar', 'konobar', 'ketering', 'restoran', 'gigzone'],
    },
    en: {
      title: 'Food & Hospitality — Chefs, Waiters & Catering | GigZone',
      description: 'Find hospitality professionals: chefs, waiters, catering and food industry workers.',
      keywords: ['chef', 'waiter', 'catering', 'hospitality', 'restaurant', 'gigzone'],
    },
    de: {
      title: 'Gastronomie — Köche, Kellner & Catering | GigZone',
      description: 'Finden Sie Gastronomiefachkräfte: Köche, Kellner, Catering und Lebensmittelindustrie.',
      keywords: ['Koch', 'Kellner', 'Catering', 'Gastronomie', 'Restaurant', 'gigzone'],
    },
  },
  marketing: {
    sr: {
      title: 'Marketing i reklama — dizajner, copywriter, SEO | GigZone',
      description: 'Pronađite marketinške stručnjake: grafièke dizajnere, copywritere, SEO eksperte i social media menadžere.',
      keywords: ['marketing', 'dizajner', 'copywriter', 'SEO', 'social media', 'gigzone'],
    },
    en: {
      title: 'Marketing & Advertising — Designers, Copywriters & SEO | GigZone',
      description: 'Find marketing professionals: graphic designers, copywriters, SEO experts and social media managers.',
      keywords: ['marketing', 'designer', 'copywriter', 'SEO', 'social media', 'gigzone'],
    },
    de: {
      title: 'Marketing & Werbung — Designer, Texter & SEO | GigZone',
      description: 'Finden Sie Marketingexperten: Grafikdesigner, Texter, SEO-Experten und Social-Media-Manager.',
      keywords: ['Marketing', 'Designer', 'Texter', 'SEO', 'Social Media', 'gigzone'],
    },
  },
  legal: {
    sr: {
      title: 'Pravo i konsalting — advokat, pravni savjetnik | GigZone',
      description: 'Pronađite pravne stručnjake: advokate, pravne savjetnike i konsultante za poslovne i privatne potrebe.',
      keywords: ['advokat', 'pravo', 'pravni savjetnik', 'konsalting', 'pravne usluge', 'gigzone'],
    },
    en: {
      title: 'Legal & Consulting — Lawyers & Legal Advisors | GigZone',
      description: 'Find legal professionals: lawyers, legal advisors and consultants for business and personal needs.',
      keywords: ['lawyer', 'legal', 'attorney', 'legal advisor', 'consulting', 'gigzone'],
    },
    de: {
      title: 'Recht & Beratung — Anwälte & Rechtsberater | GigZone',
      description: 'Finden Sie Rechtsexperten: Anwälte, Rechtsberater und Berater für geschäftliche und private Bedürfnisse.',
      keywords: ['Anwalt', 'Recht', 'Rechtsberater', 'Beratung', 'Rechtsdienstleistungen', 'gigzone'],
    },
  },
  real_estate: {
    sr: {
      title: 'Nekretnine — agent, procjena, upravljanje imovinom | GigZone',
      description: 'Pronađite stručnjake za nekretnine: agente, procjenitelje i menadžere nekretnina.',
      keywords: ['nekretnine', 'agent za nekretnine', 'procjena', 'kupovina', 'iznajmljivanje', 'gigzone'],
    },
    en: {
      title: 'Real Estate — Agents, Appraisals & Property Management | GigZone',
      description: 'Find real estate professionals: agents, appraisers and property managers.',
      keywords: ['real estate', 'agent', 'appraisal', 'property', 'buy', 'rent', 'gigzone'],
    },
    de: {
      title: 'Immobilien — Makler, Bewertung & Verwaltung | GigZone',
      description: 'Finden Sie Immobilienexperten: Makler, Gutachter und Immobilienverwalter.',
      keywords: ['Immobilien', 'Makler', 'Bewertung', 'Immobilienverwaltung', 'gigzone'],
    },
  },
  other: {
    sr: {
      title: 'Ostale usluge — pronađi stručnjaka | GigZone',
      description: 'Pronađite stručnjake za razne usluge koje ne spadaju u standardne kategorije.',
      keywords: ['usluge', 'stručnjak', 'freelancer', 'razno', 'gigzone'],
    },
    en: {
      title: 'Other Services — Find an Expert | GigZone',
      description: 'Find experts for various services that don\'t fit standard categories.',
      keywords: ['services', 'expert', 'freelancer', 'miscellaneous', 'gigzone'],
    },
    de: {
      title: 'Sonstige Dienstleistungen — Experten finden | GigZone',
      description: 'Finden Sie Experten für verschiedene Dienstleistungen, die nicht in Standardkategorien fallen.',
      keywords: ['Dienstleistungen', 'Experte', 'Freelancer', 'Sonstiges', 'gigzone'],
    },
  },
};

// Returns the human-readable category name for h1, breadcrumbs, and JSON-LD.
// Extracted from CATEGORY_SEO titles (the part before ' — ').
export function getCategoryLabel(slug: CategorySlug, lang: Lang): string {
  return CATEGORY_SEO[slug][lang].title.split(' — ')[0];
}
