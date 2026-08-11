import type {
  GuidanceIntent,
  GuidanceLanguage,
  GuidanceType,
  GuidanceNotification,
} from './types';

const BASE_URL = 'https://www.gigzone.app';

type TemplateMap = Record<GuidanceIntent | 'image_only' | 'missing_city', GuidanceNotification>;

const TEMPLATES: Record<GuidanceLanguage, TemplateMap> = {
  sr: {
    SEEKING_JOB: {
      title: 'Savjet za bolju vidljivost 💡',
      body: 'Vidimo da tražiš posao. Preporučujemo da oglas objaviš i u sekciji Poslovi — tamo te aktivno traže poslodavci.\n\n📍 Dodaj lokaciju i kratak opis iskustva za bolji doseg.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Savjet za bolji doseg 💡',
      body: 'Vidimo da tražiš radnike. Oglas u sekciji Poslovi pronalaze kandidati koji aktivno traže posao.\n\n📍 Navedi lokaciju, broj radnika i uslove.',
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
  },

  en: {
    SEEKING_JOB: {
      title: 'Tip for better visibility 💡',
      body: "We see you're looking for work. For better reach, we recommend posting your listing in the Jobs section — that's where employers actively search.\n\n📍 Add your location and a brief description of your experience.",
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Reach more candidates 💡',
      body: "We see you're hiring. For better visibility, we recommend posting in the Jobs section — that's where job seekers actively browse.\n\n📍 Add the location, number of positions and conditions.",
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
  },

  de: {
    SEEKING_JOB: {
      title: 'Tipp für mehr Sichtbarkeit 💡',
      body: 'Wir sehen, dass Sie eine Stelle suchen. Für mehr Reichweite empfehlen wir, Ihre Anzeige auch im Bereich Jobs zu veröffentlichen — dort suchen Arbeitgeber aktiv.\n\n📍 Fügen Sie Ihren Standort und eine kurze Beschreibung Ihrer Erfahrung hinzu.',
      ctaUrl: `${BASE_URL}/jobs`,
    },
    HIRING: {
      title: 'Mehr Bewerber erreichen 💡',
      body: 'Wir sehen, dass Sie Mitarbeiter suchen. Für mehr Sichtbarkeit empfehlen wir, Ihre Anzeige im Bereich Jobs zu veröffentlichen — dort suchen Arbeitssuchende aktiv.\n\n📍 Fügen Sie Standort, Anzahl der Stellen und Bedingungen hinzu.',
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

  if (guidanceType === 'image_only' || guidanceType === 'wrong_section_and_missing') {
    // image_only takes priority in messaging
    const t = { ...templates.image_only };
    t.ctaUrl = t.ctaUrl || postUrl;
    return t;
  }

  if (guidanceType === 'wrong_section') {
    const t = { ...templates[intent] };
    if (!t.ctaUrl) t.ctaUrl = `${BASE_URL}/feed`;
    return t;
  }

  if (guidanceType === 'missing_content') {
    const t = { ...templates.missing_city };
    t.ctaUrl = postUrl;
    return t;
  }

  // Fallback
  return {
    title: templates[intent]?.title ?? '💡',
    body: templates[intent]?.body ?? '',
    ctaUrl: templates[intent]?.ctaUrl ?? `${BASE_URL}/feed`,
  };
}
