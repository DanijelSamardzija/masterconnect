type TFn = (key: string) => string;

const ERROR_KEY_MAP: Record<string, string> = {
  unauthorized:       'common.error.unauthorized',
  not_authenticated:  'common.error.unauthorized',
  forbidden:          'common.error.forbidden',
  not_authorized:     'common.error.forbidden',
  not_found:          'common.error.notFound',
  business_not_found: 'common.error.notFound',
  job_not_found:      'common.error.notFound',
  doc_not_found:      'common.error.notFound',
  client_not_found:   'common.error.notFound',
};

export function friendlyError(code: string | undefined, t: TFn): string {
  const key = code ? (ERROR_KEY_MAP[code] ?? 'common.error.generic') : 'common.error.generic';
  return t(key);
}
