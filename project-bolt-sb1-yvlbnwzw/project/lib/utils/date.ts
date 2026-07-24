import { formatDistanceToNow, format } from 'date-fns';
import { sr } from 'date-fns/locale';

export function timeAgo(date: string | Date, lang?: string): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: lang === 'sr' ? sr : undefined,
  });
}

export function shortDateTime(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy. HH:mm');
}

export function shortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
