const LANG_LOCALE: Record<string, string> = {
  sr: 'sr-RS',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
};

export function langToLocale(lang: string): string {
  return LANG_LOCALE[lang] ?? 'sr-RS';
}
