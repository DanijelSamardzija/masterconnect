export const PAGE_SIZE = 20;

export const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  scam: 'Prevara',
  harassment: 'Uznemiravanje',
  inappropriate: 'Neprimjeren sadržaj',
  other: 'Ostalo',
};

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  reviewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Otvoren',
  reviewed: 'Pregledano',
  resolved: 'Riješeno',
};

export const COUNTRY_LANG_MAP: Record<string, string> = {
  // Serbian / Balkan
  'serbia': 'sr', 'srbija': 'sr',
  'croatia': 'sr', 'hrvatska': 'sr',
  'bosnia and herzegovina': 'sr', 'bosna i hercegovina': 'sr', 'bosnia': 'sr', 'bosna': 'sr',
  'montenegro': 'sr', 'crna gora': 'sr',
  'slovenia': 'sr', 'slovenija': 'sr',
  'north macedonia': 'sr', 'sjeverna makedonija': 'sr', 'macedonia': 'sr', 'makedonija': 'sr',
  // German
  'germany': 'de', 'deutschland': 'de', 'njemačka': 'de', 'nemacka': 'de', 'nemačka': 'de',
  'austria': 'de', 'österreich': 'de', 'austrija': 'de',
  'switzerland': 'de', 'schweiz': 'de', 'švicarska': 'de', 'svicarska': 'de',
  'liechtenstein': 'de',
  // French
  'france': 'fr', 'francuska': 'fr',
  'belgium': 'fr', 'belgija': 'fr',
  'luxembourg': 'fr',
  'monaco': 'fr',
  // Spanish
  'spain': 'es', 'španija': 'es', 'spanija': 'es', 'espana': 'es', 'españa': 'es',
  'mexico': 'es', 'meksiko': 'es', 'méxico': 'es',
  'argentina': 'es',
  'colombia': 'es', 'kolumbija': 'es',
  'chile': 'es',
  'peru': 'es', 'perú': 'es',
  'venezuela': 'es',
  'ecuador': 'es',
  'bolivia': 'es',
  'paraguay': 'es',
  'uruguay': 'es',
  'cuba': 'es', 'kuba': 'es',
  'costa rica': 'es',
  'panama': 'es', 'panamá': 'es',
  // Italian
  'italy': 'it', 'italija': 'it', 'italia': 'it',
  // Bulgarian
  'bulgaria': 'bg', 'bugarska': 'bg', 'bălgarija': 'bg',
  // Romanian
  'romania': 'ro', 'rumunija': 'ro', 'românia': 'ro',
  // Hungarian
  'hungary': 'hu', 'mađarska': 'hu', 'madarska': 'hu', 'magyarország': 'hu',
  // Slovak
  'slovakia': 'sk', 'slovačka': 'sk', 'slovacka': 'sk',
  // Czech
  'czech republic': 'cs', 'czechia': 'cs', 'češka': 'cs', 'ceska': 'cs',
  // Polish
  'poland': 'pl', 'poljska': 'pl', 'polska': 'pl',
  // Dutch
  'netherlands': 'nl', 'holland': 'nl', 'holandija': 'nl', 'nederland': 'nl',
  // Portuguese
  'portugal': 'pt',
  'brazil': 'pt', 'brasil': 'pt',
  // Turkish
  'turkey': 'tr', 'turska': 'tr', 'türkiye': 'tr',
  // Russian
  'russia': 'ru', 'rusija': 'ru', 'rossija': 'ru',
  // Ukrainian
  'ukraine': 'uk', 'ukrajina': 'uk',
  // Greek
  'greece': 'el', 'grčka': 'el', 'grcka': 'el',
  // Arabic
  'saudi arabia': 'ar', 'saudijska arabija': 'ar',
  'united arab emirates': 'ar', 'uae': 'ar', 'ujedinjeni arapski emirati': 'ar',
  'egypt': 'ar', 'egipat': 'ar',
  'morocco': 'ar', 'maroko': 'ar',
  // English-primary
  'united kingdom': 'en', 'uk': 'en', 'great britain': 'en', 'velika britanija': 'en',
  'united states': 'en', 'usa': 'en', 'us': 'en', 'sjedinjene države': 'en', 'sjedinjene americke drzave': 'en',
  'canada': 'en', 'kanada': 'en',
  'australia': 'en', 'australija': 'en',
  'new zealand': 'en', 'novi zeland': 'en',
  'ireland': 'en', 'irska': 'en',
  'india': 'en', 'indija': 'en',
  'bangladesh': 'en',
  'pakistan': 'en',
  'nigeria': 'en',
  'ghana': 'en',
  'kenya': 'en',
  'south africa': 'en', 'južna afrika': 'en',
  'singapore': 'en',
  'malaysia': 'en',
  'philippines': 'en', 'filipini': 'en',
};

export const LANG_INFO: Record<string, { name: string; flag: string }> = {
  sr: { name: 'Srpski', flag: '🇷🇸' },
  de: { name: 'Njemački', flag: '🇩🇪' },
  en: { name: 'Engleski', flag: '🇬🇧' },
  fr: { name: 'Francuski', flag: '🇫🇷' },
  es: { name: 'Španski', flag: '🇪🇸' },
  it: { name: 'Italijanski', flag: '🇮🇹' },
  bg: { name: 'Bugarski', flag: '🇧🇬' },
  ro: { name: 'Rumunski', flag: '🇷🇴' },
  hu: { name: 'Mađarski', flag: '🇭🇺' },
  sk: { name: 'Slovački', flag: '🇸🇰' },
  cs: { name: 'Češki', flag: '🇨🇿' },
  pl: { name: 'Poljski', flag: '🇵🇱' },
  nl: { name: 'Nizozemski', flag: '🇳🇱' },
  pt: { name: 'Portugalski', flag: '🇵🇹' },
  tr: { name: 'Turski', flag: '🇹🇷' },
  ru: { name: 'Ruski', flag: '🇷🇺' },
  uk: { name: 'Ukrajinski', flag: '🇺🇦' },
  el: { name: 'Grčki', flag: '🇬🇷' },
  ar: { name: 'Arapski', flag: '🇸🇦' },
};
