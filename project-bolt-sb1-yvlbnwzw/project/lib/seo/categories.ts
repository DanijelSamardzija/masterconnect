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
    es: {
      title: 'Construcción y Artesanía — Trabajadores cualificados | GigZone',
      description: 'Encuentra trabajadores de construcción y artesanos verificados para tu proyecto. Gratis, sin intermediarios.',
      keywords: ['construcción', 'artesanía', 'constructor', 'renovación', 'contratista', 'gigzone'],
    },
    fr: {
      title: 'Construction & Artisanat — Artisans qualifiés | GigZone',
      description: 'Trouvez des artisans du bâtiment vérifiés pour votre projet. Gratuit, sans intermédiaires.',
      keywords: ['construction', 'artisanat', 'bâtiment', 'rénovation', 'entrepreneur', 'gigzone'],
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
    es: {
      title: 'Servicios del hogar — Limpieza, Reparaciones & Mantenimiento | GigZone',
      description: 'Encuentra expertos en servicios del hogar: limpieza, reparaciones, fontanería, electricidad y más.',
      keywords: ['servicios del hogar', 'limpieza', 'fontanero', 'electricista', 'reparaciones', 'gigzone'],
    },
    fr: {
      title: 'Services à domicile — Nettoyage, Réparations & Entretien | GigZone',
      description: 'Trouvez des experts en services à domicile : nettoyage, réparations, plomberie, électricité et plus.',
      keywords: ['services à domicile', 'nettoyage', 'plombier', 'électricien', 'réparations', 'gigzone'],
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
    es: {
      title: 'IT & Tecnología — Desarrolladores, Diseño web & Soporte | GigZone',
      description: 'Encuentra expertos en IT para desarrollo de software, diseño web, redes y soporte técnico.',
      keywords: ['IT', 'desarrollador', 'diseño web', 'software', 'soporte técnico', 'gigzone'],
    },
    fr: {
      title: 'IT & Technologie — Développeurs, Webdesign & Support | GigZone',
      description: 'Trouvez des experts IT pour le développement logiciel, le webdesign, les réseaux et le support technique.',
      keywords: ['IT', 'développeur', 'webdesign', 'logiciel', 'support IT', 'gigzone'],
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
    es: {
      title: 'Salud & Medicina — Médicos, Terapeutas & Atención | GigZone',
      description: 'Encuentra profesionales de la salud: médicos, fisioterapeutas, psicólogos y personal médico.',
      keywords: ['salud', 'médico', 'fisioterapeuta', 'psicólogo', 'atención médica', 'gigzone'],
    },
    fr: {
      title: 'Santé & Médecine — Médecins, Thérapeutes & Soins | GigZone',
      description: 'Trouvez des professionnels de santé : médecins, kinésithérapeutes, psychologues et personnel médical.',
      keywords: ['santé', 'médecin', 'kinésithérapeute', 'psychologue', 'soins médicaux', 'gigzone'],
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
    es: {
      title: 'Finanzas & Contabilidad — Contables & Asesores | GigZone',
      description: 'Encuentra expertos financieros: contables, asesores fiscales y analistas financieros.',
      keywords: ['contabilidad', 'contable', 'asesor fiscal', 'finanzas', 'bookkeeping', 'gigzone'],
    },
    fr: {
      title: 'Finance & Comptabilité — Comptables & Conseillers | GigZone',
      description: 'Trouvez des experts financiers : comptables, conseillers fiscaux et analystes financiers.',
      keywords: ['comptabilité', 'comptable', 'conseiller fiscal', 'finances', 'gigzone'],
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
    es: {
      title: 'Belleza & Bienestar — Peluqueros, Esteticistas & Masaje | GigZone',
      description: 'Encuentra expertos en belleza y bienestar: peluqueros, esteticistas, masajes y tratamientos de spa.',
      keywords: ['peluquero', 'esteticista', 'masaje', 'bienestar', 'spa', 'gigzone'],
    },
    fr: {
      title: 'Beauté & Bien-être — Coiffeurs, Esthéticiens & Massage | GigZone',
      description: 'Trouvez des experts en beauté et bien-être : coiffeurs, esthéticiens, massage et soins spa.',
      keywords: ['coiffeur', 'esthéticien', 'massage', 'bien-être', 'spa', 'gigzone'],
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
    es: {
      title: 'Seguridad — Guardias, CCTV & Sistemas de alarma | GigZone',
      description: 'Encuentra profesionales de seguridad para protección física, CCTV, sistemas de alarma y ciberseguridad.',
      keywords: ['guardia de seguridad', 'CCTV', 'alarma', 'seguridad física', 'ciberseguridad', 'gigzone'],
    },
    fr: {
      title: 'Sécurité — Agents, Vidéosurveillance & Systèmes d\'alarme | GigZone',
      description: 'Trouvez des professionnels de la sécurité pour la protection physique, la vidéosurveillance, les alarmes et la cybersécurité.',
      keywords: ['agent de sécurité', 'vidéosurveillance', 'alarme', 'sécurité physique', 'cybersécurité', 'gigzone'],
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
    es: {
      title: 'Educación — Clases particulares, Tutoría & Coaching | GigZone',
      description: 'Encuentra profesores e instructores para clases particulares, aprendizaje online y formación.',
      keywords: ['clases particulares', 'tutor', 'profesor', 'aprendizaje online', 'formación', 'gigzone'],
    },
    fr: {
      title: 'Éducation — Cours particuliers, Tutorat & Coaching | GigZone',
      description: 'Trouvez des enseignants et instructeurs pour des cours particuliers, l\'apprentissage en ligne et les formations.',
      keywords: ['cours particuliers', 'tutorat', 'enseignant', 'apprentissage en ligne', 'formation', 'gigzone'],
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
    es: {
      title: 'Transporte & Entrega — Conductores, Mudanzas & Mensajería | GigZone',
      description: 'Encuentra conductores y mensajeros para mudanzas, servicios de entrega y transporte de mercancías.',
      keywords: ['transporte', 'entrega', 'conductor', 'mudanza', 'mensajería', 'gigzone'],
    },
    fr: {
      title: 'Transport & Livraison — Chauffeurs, Déménagement & Courrier | GigZone',
      description: 'Trouvez des chauffeurs et coursiers pour les déménagements, livraisons et transport de marchandises.',
      keywords: ['transport', 'livraison', 'chauffeur', 'déménagement', 'courrier', 'gigzone'],
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
    es: {
      title: 'Alimentación & Hostelería — Chefs, Camareros & Catering | GigZone',
      description: 'Encuentra profesionales de hostelería: chefs, camareros, catering y trabajadores de la industria alimentaria.',
      keywords: ['chef', 'camarero', 'catering', 'hostelería', 'restaurante', 'gigzone'],
    },
    fr: {
      title: 'Alimentation & Hôtellerie — Chefs, Serveurs & Traiteur | GigZone',
      description: 'Trouvez des professionnels de l\'hôtellerie-restauration : chefs, serveurs, traiteurs et travailleurs de l\'industrie alimentaire.',
      keywords: ['chef', 'serveur', 'traiteur', 'hôtellerie', 'restaurant', 'gigzone'],
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
    es: {
      title: 'Marketing & Publicidad — Diseñadores, Redactores & SEO | GigZone',
      description: 'Encuentra profesionales de marketing: diseñadores gráficos, redactores, expertos en SEO y gestores de redes sociales.',
      keywords: ['marketing', 'diseñador', 'redactor', 'SEO', 'redes sociales', 'gigzone'],
    },
    fr: {
      title: 'Marketing & Publicité — Designers, Rédacteurs & SEO | GigZone',
      description: 'Trouvez des professionnels du marketing : graphistes, rédacteurs, experts SEO et gestionnaires de réseaux sociaux.',
      keywords: ['marketing', 'designer', 'rédacteur', 'SEO', 'réseaux sociaux', 'gigzone'],
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
    es: {
      title: 'Legal & Consultoría — Abogados & Asesores jurídicos | GigZone',
      description: 'Encuentra profesionales jurídicos: abogados, asesores legales y consultores para necesidades empresariales y personales.',
      keywords: ['abogado', 'legal', 'asesor jurídico', 'consultoría', 'servicios legales', 'gigzone'],
    },
    fr: {
      title: 'Juridique & Conseil — Avocats & Conseillers juridiques | GigZone',
      description: 'Trouvez des professionnels juridiques : avocats, conseillers juridiques et consultants pour les besoins professionnels et personnels.',
      keywords: ['avocat', 'juridique', 'conseiller juridique', 'conseil', 'services juridiques', 'gigzone'],
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
    es: {
      title: 'Inmobiliario — Agentes, Tasaciones & Gestión de propiedades | GigZone',
      description: 'Encuentra profesionales inmobiliarios: agentes, tasadores y administradores de propiedades.',
      keywords: ['inmobiliario', 'agente inmobiliario', 'tasación', 'propiedad', 'compra', 'alquiler', 'gigzone'],
    },
    fr: {
      title: 'Immobilier — Agents, Expertises & Gestion immobilière | GigZone',
      description: 'Trouvez des professionnels de l\'immobilier : agents, experts et gestionnaires de biens.',
      keywords: ['immobilier', 'agent immobilier', 'expertise', 'gestion immobilière', 'gigzone'],
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
    es: {
      title: 'Otros servicios — Encontrar un experto | GigZone',
      description: 'Encuentra expertos para diversos servicios que no encajan en categorías estándar.',
      keywords: ['servicios', 'experto', 'freelancer', 'varios', 'gigzone'],
    },
    fr: {
      title: 'Autres services — Trouver un expert | GigZone',
      description: 'Trouvez des experts pour divers services qui ne rentrent pas dans les catégories standard.',
      keywords: ['services', 'expert', 'freelance', 'divers', 'gigzone'],
    },
  },
};

// Returns the human-readable category name for h1, breadcrumbs, and JSON-LD.
// Extracted from CATEGORY_SEO titles (the part before ' — ').
export function getCategoryLabel(slug: CategorySlug, lang: Lang): string {
  return CATEGORY_SEO[slug][lang].title.split(' — ')[0];
}
