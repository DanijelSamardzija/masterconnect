/**
 * Converts a city name to a URL-safe slug.
 * "Banja Luka" → "banja-luka"
 * "Novi Sad" → "novi-sad"
 * "Čačak" → "cacak"
 */
export function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
