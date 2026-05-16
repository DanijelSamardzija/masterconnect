import { cyrillicToLatin } from '@/components/city-autocomplete';

// Normalized lowercase country code or name → ISO 2-letter code
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'serbia': 'rs', 'srbija': 'rs',
  'croatia': 'hr', 'hrvatska': 'hr',
  'bosnia and herzegovina': 'ba', 'bosna i hercegovina': 'ba', 'bosnia': 'ba', 'bosna': 'ba',
  'germany': 'de', 'deutschland': 'de', 'nemacka': 'de', 'nemačka': 'de',
  'austria': 'at', 'österreich': 'at', 'austrija': 'at',
  'switzerland': 'ch', 'schweiz': 'ch', 'švajcarska': 'ch',
  'slovenia': 'si', 'slovenija': 'si',
  'montenegro': 'me', 'crna gora': 'me',
  'north macedonia': 'mk', 'severna makedonija': 'mk', 'macedonia': 'mk',
  'albania': 'al', 'albanija': 'al',
  'hungary': 'hu', 'mađarska': 'hu', 'madarska': 'hu',
  'romania': 'ro', 'rumunija': 'ro',
  'bulgaria': 'bg', 'bugarska': 'bg',
  'greece': 'gr', 'grčka': 'gr', 'grcka': 'gr',
  'turkey': 'tr', 'turska': 'tr',
  'italy': 'it', 'italija': 'it',
  'france': 'fr', 'francuska': 'fr',
  'spain': 'es', 'španija': 'es', 'spanija': 'es',
  'portugal': 'pt', 'portugalija': 'pt',
  'netherlands': 'nl', 'holandija': 'nl',
  'belgium': 'be', 'belgija': 'be',
  'luxembourg': 'lu', 'luksemburg': 'lu',
  'sweden': 'se', 'svedska': 'se', 'švedska': 'se',
  'norway': 'no', 'norveska': 'no', 'norveška': 'no',
  'denmark': 'dk', 'danska': 'dk',
  'finland': 'fi', 'finska': 'fi',
  'poland': 'pl', 'poljska': 'pl',
  'czech republic': 'cz', 'czechia': 'cz', 'ceska': 'cz', 'češka': 'cz',
  'slovakia': 'sk', 'slovacka': 'sk', 'slovačka': 'sk',
  'ukraine': 'ua', 'ukraina': 'ua', 'ukrajina': 'ua',
  'united kingdom': 'gb', 'uk': 'gb', 'great britain': 'gb',
  'ireland': 'ie', 'irska': 'ie',
  'united states': 'us', 'usa': 'us', 'america': 'us',
  'canada': 'ca', 'kanada': 'ca',
  'australia': 'au', 'australija': 'au',
  'new zealand': 'nz', 'novi zeland': 'nz',
};

const NEARBY_COUNTRIES: Record<string, string[]> = {
  'rs': ['ba', 'hr', 'me', 'mk', 'si', 'hu', 'ro', 'bg', 'al'],
  'ba': ['rs', 'hr', 'me', 'si'],
  'hr': ['rs', 'ba', 'si', 'me', 'hu', 'at'],
  'me': ['rs', 'ba', 'hr', 'al', 'mk'],
  'mk': ['rs', 'me', 'bg', 'al', 'gr'],
  'si': ['hr', 'at', 'it', 'hu', 'rs'],
  'al': ['me', 'mk', 'gr'],
  'de': ['at', 'ch', 'nl', 'be', 'fr', 'pl', 'cz', 'lu'],
  'at': ['de', 'ch', 'hu', 'si', 'hr', 'it', 'sk'],
  'ch': ['de', 'at', 'fr', 'it'],
  'hu': ['rs', 'hr', 'si', 'at', 'sk', 'ro', 'ua'],
  'ro': ['rs', 'hu', 'bg', 'md', 'ua'],
  'bg': ['rs', 'mk', 'ro', 'gr', 'tr'],
  'gr': ['bg', 'mk', 'al', 'tr'],
  'it': ['fr', 'ch', 'at', 'si'],
  'fr': ['de', 'be', 'ch', 'it', 'es', 'lu'],
  'es': ['fr', 'pt'],
  'pt': ['es'],
  'nl': ['de', 'be', 'lu'],
  'be': ['nl', 'de', 'fr', 'lu'],
  'pl': ['de', 'cz', 'sk', 'ua'],
  'cz': ['sk', 'de', 'at', 'pl'],
  'sk': ['hu', 'cz', 'pl', 'at', 'ua'],
  'ua': ['pl', 'sk', 'hu', 'ro'],
  'se': ['no', 'dk', 'fi'],
  'no': ['se', 'dk', 'fi'],
  'dk': ['se', 'no', 'de'],
  'fi': ['se', 'no'],
  'gb': ['ie'],
  'ie': ['gb'],
  'us': ['ca'],
  'ca': ['us'],
};

export function normalizeCountry(country: string | null | undefined): string {
  if (!country) return '';
  const lower = cyrillicToLatin(country).toLowerCase().trim();
  if (lower.length === 2) return lower;
  return COUNTRY_NAME_TO_CODE[lower] || lower;
}

export function isNearbyCountry(userCountry: string, postCountry: string): boolean {
  const uc = normalizeCountry(userCountry);
  const pc = normalizeCountry(postCountry);
  if (!uc || !pc) return false;
  return (NEARBY_COUNTRIES[uc] || []).includes(pc);
}

// Returns 0 (best) to 3 (worst) — lower = closer to user
export function locationScore(
  userCity: string,
  userCountry: string,
  postCity: string,
  postCountry: string,
): number {
  const uc = cyrillicToLatin(userCity).toLowerCase().trim();
  const pc = cyrillicToLatin(postCity).toLowerCase().trim();
  if (uc && pc && pc.includes(uc)) return 0;

  const uCountry = normalizeCountry(userCountry);
  const pCountry = normalizeCountry(postCountry);
  if (uCountry && pCountry && uCountry === pCountry) return 1;
  if (isNearbyCountry(userCountry, postCountry)) return 2;
  return 3;
}
