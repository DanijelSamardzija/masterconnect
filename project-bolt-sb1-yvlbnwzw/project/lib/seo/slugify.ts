/**
 * Converts any Unicode city name to a URL-safe ASCII slug.
 *
 * Strategy:
 * 1. Lowercase first
 * 2. Explicitly transliterate characters that don't decompose via NFD
 *    (ø, ł, ß, æ, etc. — these are base characters, not composites)
 * 3. NFD-normalise to decompose composites (ü→u+¨, é→e+´, etc.)
 * 4. Strip all combining diacritical marks (U+0300–U+036F)
 * 5. Remove anything not a-z, digit, space, or hyphen
 * 6. Collapse spaces → hyphens
 *
 * Examples:
 *   "São Paulo"  → "sao-paulo"
 *   "München"    → "munchen"
 *   "København"  → "kobenhavn"
 *   "Łódź"       → "lodz"
 *   "İstanbul"   → "istanbul"
 *   "Göteborg"   → "goteborg"
 */
export function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    // Transliterate characters that have no NFD decomposition
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/đ/g, 'd')
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/ı/g, 'i')   // Turkish dotless i
    .replace(/ŋ/g, 'n')
    .replace(/ŧ/g, 't')
    // NFD decompose + strip combining diacritical marks (U+0300–U+036F)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Remove anything remaining that isn't ASCII alphanumeric, space, or hyphen
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Converts a city slug back to a search string for ILIKE queries.
 * "banja-luka" → "banja luka"
 * Used with: WHERE lower(city) ILIKE lower('%' || unslugifyCity(slug) || '%')
 */
export function unslugifyCity(slug: string): string {
  return slug.replace(/-/g, ' ');
}

/**
 * Converts a city slug to a human-readable display name.
 * "banja-luka" → "Banja Luka"
 * "sao-paulo"  → "Sao Paulo"
 * Used in page titles, h1, and breadcrumbs.
 */
export function humanizeCity(slug: string): string {
  return unslugifyCity(slug)
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Country names follow the same Unicode rules as city names.
// Separate exports for semantic clarity in calling code.
// When /services/{category}/{country}/{city} routing is needed,
// import slugifyCountry, unslugifyCountry, humanizeCountry from here.
export const slugifyCountry = slugifyCity;
export const unslugifyCountry = unslugifyCity;
export const humanizeCountry = humanizeCity;
