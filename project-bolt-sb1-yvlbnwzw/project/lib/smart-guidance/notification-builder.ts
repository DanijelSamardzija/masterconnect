import type {
  GuidanceIntent,
  GuidanceLanguage,
  GuidanceType,
  GuidanceNotification,
} from './types';

const BASE_URL = 'https://www.gigzone.app';

type TemplateMap = Record<GuidanceIntent | 'image_only' | 'missing_city' | 'service_to_feed', GuidanceNotification>;

const TEMPLATES: Record<GuidanceLanguage, TemplateMap> = {
  sr: {
    SEEKING_JOB: {
      title: 'Pronađi posao na pravom mjestu 🎯',
      body: 'Vidimo da tražiš posao. 👤 Objavi svoju potragu u Poslovi → Tražim posao, gdje te mogu pronaći poslodavci koji aktivno traže radnike.\n\nNapiši koji posao tražiš, gdje želiš da radiš, kakvo iskustvo imaš i kada si dostupan. Što više konkretnih informacija navedeš, poslodavci će lakše procijeniti da li si pravi kandidat.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Objavi oglas tamo gdje ga traže kandidati 🎯',
      body: 'Vidimo da tražiš radnike. 👷‍♂️ Ovakve objave najbolje je postaviti u Poslovi → Tražim radnika, gdje ih mogu pronaći ljudi koji aktivno traže posao.\n\nDodaj grad, poziciju, broj potrebnih radnika i osnovne uslove kako bi kandidati odmah znali šta nudiš i gdje se posao obavlja.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    OFFERING_SERVICE: {
      title: 'Savjet za bolju vidljivost 💡',
      body: 'Vidimo da nudiš uslugu. Preporučujemo da objaviš i u sekciji Usluge — tamo te traže klijenti koji aktivno pretražuju.\n\n📍 Dodaj lokaciju i fotografije svog rada.',
      ctaUrl: `${BASE_URL}/services`,
    },
    SEEKING_SERVICE: {
      title: 'Savjet za bolju vidljivost 💡',
      body: 'Vidimo da tražiš pružaoca usluge. Preporučujemo da zahtjev objaviš i u sekciji Poslovi — tamo ga pronalaze profesionalci koji nude usluge.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    PORTFOLIO: {
      title: 'Poboljšajte prezentaciju radova 📸',
      body: 'Vaši radovi izgledaju odlično! Za veću vidljivost dodajte opis — šta ste radili, koji materijali, lokacija i kako vas kontaktirati.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    SOCIAL: {
      title: 'Dodajte opis uz sliku 📝',
      body: 'Slika privlači pažnju, ali tekstualni opis daje korisnicima kontekst i pomaže im da razumiju sadržaj. Preporučujemo da dodate nekoliko rečenica.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    image_only: {
      title: 'Dodajte opis uz sliku 📝',
      body: 'Slika je odlična za privlačenje pažnje. Tekstualni opis daje korisnicima kontekst i pomaže im da odmah razumiju šta nudite ili tražite.\n\nPreporučujemo da najvažnije informacije dodate i kao tekst uz objavu.',
      ctaUrl: '',  // filled dynamically with post URL
    },
    missing_city: {
      title: 'Poboljšajte oglas 📍',
      body: 'Oglas je u pravoj sekciji. Za veću vidljivost preporučujemo da dodate lokaciju — klijenti filtriraju po gradu i bez nje vaš oglas ostaje nevidljiv.',
      ctaUrl: '',  // filled dynamically with post URL
    },
    service_to_feed: {
      title: 'Pokaži svoje radove i povećaj vidljivost 💡',
      body: 'Tvoja usluga je na GigZone-u — odlično! Objavi fotografije ili video svojih radova u Feedu i uz to napiši nekoliko konkretnih rečenica: šta si radio, koju uslugu nudiš i gde radiš.\n\nTako će ljudi bolje razumeti čime se baviš i lakše odlučiti da te kontaktiraju.',
      ctaUrl: `${BASE_URL}/feed`,
    },
  },

  en: {
    SEEKING_JOB: {
      title: 'Find a job in the right place 🎯',
      body: "We see that you're looking for a job. 👤 Post your job search in Jobs → Looking for a Job, where employers actively looking for workers can find you.\n\nInclude the type of job you're looking for, where you want to work, your experience, and when you're available. The more specific information you provide, the easier it is for employers to see if you're the right candidate.",
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Post where job seekers are looking 🎯',
      body: "We see you're looking for workers. 👷‍♂️ This kind of listing gets better results in Jobs → Hiring, where people actively searching for work can find it.\n\nAdd your city, position, number of workers needed and basic conditions so candidates know right away what you're offering and where the job is.",
      ctaUrl: `${BASE_URL}/jobs`,
    },
    OFFERING_SERVICE: {
      title: 'Get more clients 💡',
      body: "We see you're offering a service. For better visibility, we recommend also posting in the Services section — that's where clients actively search.\n\n📍 Add your location and photos of your work.",
      ctaUrl: `${BASE_URL}/services`,
    },
    SEEKING_SERVICE: {
      title: 'Find service providers faster 💡',
      body: "We see you're looking for a service provider. We recommend posting your request in the Jobs section — that's where professionals offering services can find it.",
      ctaUrl: `${BASE_URL}/jobs`,
    },
    PORTFOLIO: {
      title: 'Improve your portfolio presentation 📸',
      body: 'Your work looks great! For better visibility, add a description — what you did, materials used, location, and how to contact you.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    SOCIAL: {
      title: 'Add a description to your image 📝',
      body: 'Images attract attention, but a text description gives users context and helps them understand your content. We recommend adding a few sentences.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    image_only: {
      title: 'Add a text description 📝',
      body: "Your image is great for grabbing attention. A text description gives users context and helps them understand what you're offering or looking for right away.\n\nWe recommend adding the key details as text alongside your post.",
      ctaUrl: '',
    },
    missing_city: {
      title: 'Improve your listing 📍',
      body: "Your listing is in the right section. For better visibility, we recommend adding your location — clients filter by city, and without it your listing may be harder to find.",
      ctaUrl: '',
    },
    service_to_feed: {
      title: 'Show your work and get more visibility 💡',
      body: "Your service is already on GigZone — great! Post photos or a video of your work in the Feed and write a few concrete sentences alongside it: what you did, what service you offer, and where you're based.\n\nThis helps people understand exactly what you do and makes it easier for them to decide to contact you.",
      ctaUrl: `${BASE_URL}/feed`,
    },
  },

  de: {
    SEEKING_JOB: {
      title: 'Finden Sie einen Job am richtigen Ort 🎯',
      body: 'Wir sehen, dass Sie auf Jobsuche sind. 👤 Veröffentlichen Sie Ihre Jobsuche unter Jobs → Arbeitssuchend, damit Arbeitgeber, die aktiv nach Mitarbeitern suchen, Sie leichter finden können.\n\nGeben Sie an, welche Arbeit Sie suchen, wo Sie arbeiten möchten, welche Erfahrung Sie haben und wann Sie verfügbar sind. Je konkreter Ihre Angaben sind, desto leichter können Arbeitgeber einschätzen, ob Sie der richtige Kandidat sind.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Inserieren Sie dort, wo Jobsuchende suchen 🎯',
      body: 'Wir sehen, dass Sie Mitarbeiter suchen. 👷‍♂️ Solche Anzeigen erzielen bessere Ergebnisse im Bereich Jobs → Stelle ausschreiben, wo Menschen, die aktiv nach Arbeit suchen, sie finden können.\n\nFügen Sie Ihren Standort, die Position, die Anzahl der benötigten Mitarbeiter und die wichtigsten Bedingungen hinzu, damit Kandidaten sofort wissen, was Sie anbieten und wo die Stelle ist.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    OFFERING_SERVICE: {
      title: 'Mehr Kunden gewinnen 💡',
      body: 'Wir sehen, dass Sie eine Dienstleistung anbieten. Für mehr Sichtbarkeit empfehlen wir, auch im Bereich Dienstleistungen zu inserieren — dort suchen Kunden aktiv.\n\n📍 Fügen Sie Ihren Standort und Fotos Ihrer Arbeit hinzu.',
      ctaUrl: `${BASE_URL}/services`,
    },
    SEEKING_SERVICE: {
      title: 'Dienstleister schneller finden 💡',
      body: 'Wir sehen, dass Sie einen Dienstleister suchen. Wir empfehlen, Ihre Anfrage im Bereich Jobs zu veröffentlichen — dort können Fachleute, die Dienstleistungen anbieten, sie finden.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    PORTFOLIO: {
      title: 'Portfolio-Präsentation verbessern 📸',
      body: 'Ihre Arbeit sieht toll aus! Für mehr Sichtbarkeit fügen Sie eine Beschreibung hinzu — was Sie gemacht haben, verwendete Materialien, Standort und Kontaktmöglichkeiten.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    SOCIAL: {
      title: 'Beschreibung zum Bild hinzufügen 📝',
      body: 'Bilder ziehen Aufmerksamkeit auf sich, aber eine Textbeschreibung gibt Nutzern Kontext und hilft ihnen, den Inhalt zu verstehen. Wir empfehlen, einige Sätze hinzuzufügen.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    image_only: {
      title: 'Textbeschreibung hinzufügen 📝',
      body: 'Ihr Bild zieht Aufmerksamkeit auf sich. Eine Textbeschreibung gibt Nutzern Kontext und hilft ihnen sofort zu verstehen, was Sie anbieten oder suchen.\n\nWir empfehlen, die wichtigsten Informationen auch als Text hinzuzufügen.',
      ctaUrl: '',
    },
    missing_city: {
      title: 'Anzeige verbessern 📍',
      body: 'Ihre Anzeige ist im richtigen Bereich. Für mehr Sichtbarkeit empfehlen wir, Ihren Standort hinzuzufügen — Kunden filtern nach Stadt, und ohne Standortangabe ist Ihre Anzeige schwerer zu finden.',
      ctaUrl: '',
    },
    service_to_feed: {
      title: 'Zeigen Sie Ihre Arbeit und erhöhen Sie Ihre Sichtbarkeit 💡',
      body: 'Ihr Dienst ist bereits auf GigZone — super! Veröffentlichen Sie Fotos oder ein Video Ihrer Arbeiten im Feed und schreiben Sie dazu einige konkrete Sätze: was Sie gemacht haben, welche Dienstleistung Sie anbieten und wo Sie tätig sind.\n\nSo können Menschen besser verstehen, womit Sie sich beschäftigen, und leichter entscheiden, Sie zu kontaktieren.',
      ctaUrl: `${BASE_URL}/feed`,
    },
  },

  es: {
    SEEKING_JOB: {
      title: 'Encuentra trabajo en el lugar correcto 🎯',
      body: 'Vemos que buscas trabajo. 👤 Publica tu búsqueda en Empleos → Busco trabajo, donde los empleadores que buscan activamente trabajadores pueden encontrarte.\n\nIndica qué trabajo buscas, dónde quieres trabajar, tu experiencia y cuándo estás disponible. Cuanta más información concreta aportes, más fácil será para los empleadores evaluar si eres el candidato adecuado.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Publica donde los candidatos buscan trabajo 🎯',
      body: 'Vemos que buscas trabajadores. 👷‍♂️ Este tipo de anuncio obtiene mejores resultados en Empleos → Busco trabajador, donde las personas que buscan trabajo activamente pueden encontrarlo.\n\nAñade tu ciudad, el puesto, el número de trabajadores necesarios y las condiciones básicas para que los candidatos sepan de inmediato qué ofreces y dónde es el trabajo.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    OFFERING_SERVICE: {
      title: 'Consigue más clientes 💡',
      body: 'Vemos que ofreces un servicio. Para mayor visibilidad, te recomendamos publicar también en la sección Servicios — allí es donde los clientes buscan activamente.\n\n📍 Añade tu ubicación y fotos de tu trabajo.',
      ctaUrl: `${BASE_URL}/services`,
    },
    SEEKING_SERVICE: {
      title: 'Encuentra proveedores de servicios más rápido 💡',
      body: 'Vemos que buscas un proveedor de servicios. Te recomendamos publicar tu solicitud en la sección Empleos — allí es donde los profesionales que ofrecen servicios pueden encontrarla.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    PORTFOLIO: {
      title: 'Mejora la presentación de tu portafolio 📸',
      body: '¡Tu trabajo se ve genial! Para mayor visibilidad, añade una descripción — qué hiciste, materiales utilizados, ubicación y cómo contactarte.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    SOCIAL: {
      title: 'Añade una descripción a tu imagen 📝',
      body: 'Las imágenes atraen la atención, pero una descripción de texto da contexto a los usuarios y les ayuda a entender tu contenido. Te recomendamos añadir algunas frases.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    image_only: {
      title: 'Añade una descripción de texto 📝',
      body: 'Tu imagen es excelente para captar la atención. Una descripción de texto da contexto a los usuarios y les ayuda a entender de inmediato qué ofreces o buscas.\n\nTe recomendamos añadir los detalles clave como texto junto a tu publicación.',
      ctaUrl: '',
    },
    missing_city: {
      title: 'Mejora tu anuncio 📍',
      body: 'Tu anuncio está en la sección correcta. Para mayor visibilidad, te recomendamos añadir tu ubicación — los clientes filtran por ciudad y sin ella tu anuncio puede ser más difícil de encontrar.',
      ctaUrl: '',
    },
    service_to_feed: {
      title: 'Muestra tu trabajo y aumenta tu visibilidad 💡',
      body: 'Tu servicio ya está en GigZone — ¡genial! Publica fotos o un vídeo de tu trabajo en el Feed y escribe algunas frases concretas: qué hiciste, qué servicio ofreces y dónde te encuentras.\n\nAsí las personas entenderán mejor a qué te dedicas y les resultará más fácil decidir contactarte.',
      ctaUrl: `${BASE_URL}/feed`,
    },
  },

  fr: {
    SEEKING_JOB: {
      title: 'Trouvez un emploi au bon endroit 🎯',
      body: 'Nous voyons que vous cherchez un emploi. 👤 Publiez votre recherche dans Emplois → Je cherche un emploi, où les employeurs qui recherchent activement des travailleurs pourront vous trouver.\n\nIndiquez quel type de travail vous recherchez, où vous souhaitez travailler, votre expérience et vos disponibilités. Plus vos informations sont précises, plus il sera facile pour les employeurs d\'évaluer si vous êtes le bon candidat.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Publiez là où les candidats cherchent 🎯',
      body: 'Nous voyons que vous cherchez des travailleurs. 👷‍♂️ Ce type d\'annonce obtient de meilleurs résultats dans Emplois → Je cherche un travailleur, où les personnes en recherche active d\'emploi peuvent la trouver.\n\nAjoutez votre ville, le poste, le nombre de travailleurs nécessaires et les conditions de base afin que les candidats sachent immédiatement ce que vous proposez et où se déroule le travail.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    OFFERING_SERVICE: {
      title: 'Obtenez plus de clients 💡',
      body: 'Nous voyons que vous proposez un service. Pour plus de visibilité, nous vous recommandons de publier également dans la section Services — c\'est là que les clients recherchent activement.\n\n📍 Ajoutez votre emplacement et des photos de votre travail.',
      ctaUrl: `${BASE_URL}/services`,
    },
    SEEKING_SERVICE: {
      title: 'Trouvez des prestataires plus rapidement 💡',
      body: 'Nous voyons que vous cherchez un prestataire de services. Nous vous recommandons de publier votre demande dans la section Emplois — c\'est là que les professionnels proposant des services peuvent la trouver.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    PORTFOLIO: {
      title: 'Améliorez la présentation de votre portfolio 📸',
      body: 'Votre travail est superbe ! Pour plus de visibilité, ajoutez une description — ce que vous avez fait, les matériaux utilisés, l\'emplacement et comment vous contacter.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    SOCIAL: {
      title: 'Ajoutez une description à votre image 📝',
      body: 'Les images attirent l\'attention, mais une description textuelle donne du contexte aux utilisateurs et les aide à comprendre votre contenu. Nous vous recommandons d\'ajouter quelques phrases.',
      ctaUrl: `${BASE_URL}/feed`,
    },
    image_only: {
      title: 'Ajoutez une description textuelle 📝',
      body: 'Votre image est excellente pour attirer l\'attention. Une description textuelle donne du contexte aux utilisateurs et les aide à comprendre immédiatement ce que vous proposez ou recherchez.\n\nNous vous recommandons d\'ajouter les informations clés sous forme de texte avec votre publication.',
      ctaUrl: '',
    },
    missing_city: {
      title: 'Améliorez votre annonce 📍',
      body: 'Votre annonce est dans la bonne section. Pour plus de visibilité, nous vous recommandons d\'ajouter votre emplacement — les clients filtrent par ville et sans cela votre annonce peut être plus difficile à trouver.',
      ctaUrl: '',
    },
    service_to_feed: {
      title: 'Montrez votre travail et gagnez en visibilité 💡',
      body: 'Votre service est déjà sur GigZone — super ! Publiez des photos ou une vidéo de votre travail dans le Feed et écrivez quelques phrases concrètes : ce que vous avez fait, quel service vous proposez et où vous êtes basé.\n\nAinsi, les gens comprendront mieux votre activité et pourront plus facilement décider de vous contacter.',
      ctaUrl: `${BASE_URL}/feed`,
    },
  },
};

export function buildNotification(
  lang: GuidanceLanguage,
  intent: GuidanceIntent,
  guidanceType: GuidanceType,
  postId: string
): GuidanceNotification {
  const templates = TEMPLATES[lang];
  const postUrl = `${BASE_URL}/posts/${postId}`;

  if (guidanceType === 'image_only') {
    const t = { ...templates.image_only };
    t.ctaUrl = t.ctaUrl || postUrl;
    return t;
  }

  if (guidanceType === 'wrong_section' || guidanceType === 'wrong_section_and_missing') {
    const t = { ...templates[intent] };
    if (!t.ctaUrl) t.ctaUrl = `${BASE_URL}/feed`;
    return t;
  }

  if (guidanceType === 'missing_content') {
    const t = { ...templates.missing_city };
    t.ctaUrl = postUrl;
    return t;
  }

  if (guidanceType === 'service_to_feed') {
    return { ...templates.service_to_feed };
  }

  // Fallback
  return {
    title: templates[intent]?.title ?? '💡',
    body: templates[intent]?.body ?? '',
    ctaUrl: templates[intent]?.ctaUrl ?? `${BASE_URL}/feed`,
  };
}
