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
    es: {
      title: 'Empleos en Construcción & Oficios | GigZone',
      description: 'Ofertas de empleo en construcción y oficios especializados. Encuentra trabajo o publica un anuncio para artesanos y constructores.',
      keywords: ['empleos construcción', 'trabajos oficios', 'albañil trabajo', 'artesano contratación', 'obreros renovación', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Construction & Métiers | GigZone',
      description: 'Offres d\'emploi en construction et métiers qualifiés. Trouvez du travail ou publiez une offre pour artisans et maçons.',
      keywords: ['emplois construction', 'métiers qualifiés', 'maçon travail', 'artisan recrutement', 'ouvriers rénovation', 'gigzone'],
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
    es: {
      title: 'Empleos en Servicios del Hogar | GigZone',
      description: 'Ofertas de empleo en servicios del hogar: limpieza, fontanería, electricidad y reparaciones generales.',
      keywords: ['empleos servicios hogar', 'fontanero trabajo', 'limpieza empleo', 'electricista contratación', 'mantenimiento trabajo', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Services à Domicile | GigZone',
      description: 'Offres d\'emploi en services à domicile : ménage, plomberie, électricité et réparations générales.',
      keywords: ['emplois services domicile', 'plombier travail', 'ménage emploi', 'électricien recrutement', 'maintenance travail', 'gigzone'],
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
    es: {
      title: 'Empleos en IT & Tecnología | GigZone',
      description: 'Ofertas de empleo en IT — desarrolladores, diseñadores web, administradores de sistemas y soporte técnico.',
      keywords: ['empleos IT', 'desarrollador trabajo', 'diseño web empleo', 'empleos tecnología', 'software contratación', 'gigzone'],
    },
    fr: {
      title: 'Emplois en IT & Technologie | GigZone',
      description: 'Offres d\'emploi en IT — développeurs, designers web, administrateurs systèmes et support technique.',
      keywords: ['emplois IT', 'développeur travail', 'design web emploi', 'emplois tech', 'logiciel recrutement', 'gigzone'],
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
    es: {
      title: 'Empleos en Salud & Medicina | GigZone',
      description: 'Ofertas de empleo en salud y medicina — médicos, fisioterapeutas, enfermeros y personal sanitario.',
      keywords: ['empleos salud', 'empleos médicos', 'médico contratación', 'fisioterapeuta trabajo', 'empleos enfermería', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Santé & Médecine | GigZone',
      description: 'Offres d\'emploi en santé et médecine — médecins, kinésithérapeutes, infirmiers et personnel médical.',
      keywords: ['emplois santé', 'emplois médicaux', 'médecin recrutement', 'kinésithérapeute travail', 'emplois infirmiers', 'gigzone'],
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
    es: {
      title: 'Empleos en Finanzas & Contabilidad | GigZone',
      description: 'Ofertas de empleo en finanzas — contables, asesores fiscales y analistas financieros.',
      keywords: ['empleos finanzas', 'empleos contabilidad', 'contable contratación', 'asesor fiscal trabajo', 'analista financiero', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Finance & Comptabilité | GigZone',
      description: 'Offres d\'emploi en finance — comptables, conseillers fiscaux et analystes financiers.',
      keywords: ['emplois finance', 'emplois comptabilité', 'comptable recrutement', 'conseiller fiscal travail', 'analyste financier', 'gigzone'],
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
    es: {
      title: 'Empleos en Belleza & Bienestar | GigZone',
      description: 'Ofertas de empleo en belleza y bienestar — peluqueros, esteticistas, masajistas y profesionales de spa.',
      keywords: ['empleos belleza', 'peluquero trabajo', 'esteticista contratación', 'masajista empleo', 'empleos spa', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Beauté & Bien-être | GigZone',
      description: 'Offres d\'emploi en beauté et bien-être — coiffeurs, esthéticiennes, massothérapeutes et professionnels spa.',
      keywords: ['emplois beauté', 'coiffeur travail', 'esthéticienne recrutement', 'massothérapeute emploi', 'emplois spa', 'gigzone'],
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
    es: {
      title: 'Empleos en Seguridad | GigZone',
      description: 'Ofertas de empleo en seguridad — guardias de seguridad, operadores de CCTV, técnicos de alarmas y profesionales de ciberseguridad.',
      keywords: ['empleos seguridad', 'guardia seguridad trabajo', 'empleos CCTV', 'técnico alarmas contratación', 'empleos ciberseguridad', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Sécurité | GigZone',
      description: 'Offres d\'emploi en sécurité — agents de sécurité, opérateurs CCTV, techniciens alarmes et professionnels cybersécurité.',
      keywords: ['emplois sécurité', 'agent sécurité travail', 'emplois CCTV', 'technicien alarme recrutement', 'emplois cybersécurité', 'gigzone'],
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
    es: {
      title: 'Empleos en Educación & Docencia | GigZone',
      description: 'Ofertas de empleo en educación — profesores, instructores, tutores y formadores.',
      keywords: ['empleos docencia', 'profesor trabajo', 'tutor contratación', 'empleos educación', 'formador empleo', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Éducation & Enseignement | GigZone',
      description: 'Offres d\'emploi en éducation — enseignants, instructeurs, tuteurs et formateurs.',
      keywords: ['emplois enseignement', 'professeur travail', 'tuteur recrutement', 'emplois éducation', 'formateur emploi', 'gigzone'],
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
    es: {
      title: 'Empleos en Transporte & Reparto | GigZone',
      description: 'Ofertas de empleo en transporte y reparto — conductores, mensajeros, personal de mudanzas y logística.',
      keywords: ['empleos conductor', 'reparto trabajo', 'mensajero contratación', 'empleos transporte', 'empleos logística', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Transport & Livraison | GigZone',
      description: 'Offres d\'emploi en transport et livraison — chauffeurs, coursiers, déménageurs et logisticiens.',
      keywords: ['emplois chauffeur', 'livraison travail', 'coursier recrutement', 'emplois transport', 'emplois logistique', 'gigzone'],
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
    es: {
      title: 'Empleos en Alimentación & Hostelería | GigZone',
      description: 'Ofertas de empleo en hostelería — chefs, camareros, catering y trabajadores de la industria alimentaria.',
      keywords: ['empleos chef', 'camarero trabajo', 'catering contratación', 'empleos hostelería', 'empleos restaurante', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Alimentation & Hôtellerie | GigZone',
      description: 'Offres d\'emploi en hôtellerie-restauration — chefs, serveurs, traiteurs et travailleurs de l\'industrie alimentaire.',
      keywords: ['emplois chef', 'serveur travail', 'traiteur recrutement', 'emplois hôtellerie', 'emplois restaurant', 'gigzone'],
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
    es: {
      title: 'Empleos en Marketing & Publicidad | GigZone',
      description: 'Ofertas de empleo en marketing — diseñadores gráficos, redactores, expertos en SEO y gestores de redes sociales.',
      keywords: ['empleos marketing', 'diseñador trabajo', 'redactor contratación', 'empleos SEO', 'empleos redes sociales', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Marketing & Publicité | GigZone',
      description: 'Offres d\'emploi en marketing — graphistes, rédacteurs, experts SEO et gestionnaires de réseaux sociaux.',
      keywords: ['emplois marketing', 'designer travail', 'rédacteur recrutement', 'emplois SEO', 'emplois réseaux sociaux', 'gigzone'],
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
    es: {
      title: 'Empleos en Jurídico & Consultoría | GigZone',
      description: 'Ofertas de empleo en derecho y consultoría — abogados, asesores jurídicos y consultores empresariales.',
      keywords: ['empleos jurídicos', 'abogado trabajo', 'asesor jurídico contratación', 'empleos consultoría', 'empleos asesor legal', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Juridique & Conseil | GigZone',
      description: 'Offres d\'emploi en droit et conseil — avocats, conseillers juridiques et consultants d\'entreprise.',
      keywords: ['emplois juridiques', 'avocat travail', 'conseiller juridique recrutement', 'emplois conseil', 'emplois conseiller légal', 'gigzone'],
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
    es: {
      title: 'Empleos en Inmobiliario | GigZone',
      description: 'Ofertas de empleo en el sector inmobiliario — agentes, tasadores y administradores de propiedades.',
      keywords: ['empleos inmobiliario', 'agente inmobiliario trabajo', 'administrador propiedades contratación', 'tasador empleo', 'gigzone'],
    },
    fr: {
      title: 'Emplois en Immobilier | GigZone',
      description: 'Offres d\'emploi dans l\'immobilier — agents, experts et gestionnaires de biens.',
      keywords: ['emplois immobilier', 'agent immobilier travail', 'gestionnaire biens recrutement', 'expert immobilier emploi', 'gigzone'],
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
    es: {
      title: 'Otras Ofertas de Empleo | GigZone',
      description: 'Ofertas de empleo que no encajan en categorías estándar. Encuentra trabajo o publica un anuncio para distintos perfiles.',
      keywords: ['otros empleos', 'trabajo varios', 'freelance empleo', 'ofertas trabajo', 'gigzone'],
    },
    fr: {
      title: 'Autres Offres d\'emploi | GigZone',
      description: 'Offres d\'emploi qui ne rentrent pas dans les catégories standard. Trouvez du travail ou publiez une offre pour différents profils.',
      keywords: ['autres emplois', 'travail divers', 'freelance emploi', 'offres emploi', 'gigzone'],
    },
  },
};

// Re-export so callers only need one import for jobs SEO.
export { CATEGORY_SLUGS, isValidCategory, getCategoryLabel, type CategorySlug } from './categories';
