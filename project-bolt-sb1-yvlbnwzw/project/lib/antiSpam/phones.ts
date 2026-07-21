import { ANTI_SPAM_CONFIG } from './config';
import { devLog } from '@/lib/dev-log';

export function normalizePhone(raw: string): string | null {
  let cleaned = raw.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('+381')) {
    const rest = cleaned.slice(4);
    if (rest.startsWith('0')) {
      cleaned = '+381' + rest.slice(1);
    }
  } else if (cleaned.startsWith('381') && !cleaned.startsWith('+')) {
    const rest = cleaned.slice(3);
    if (rest.startsWith('0')) {
      cleaned = '+381' + rest.slice(1);
    } else {
      cleaned = '+381' + rest;
    }
  } else if (cleaned.match(/^0\d{8,}$/)) {
    cleaned = '+381' + cleaned.slice(1);
  } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
    return null;
  }

  const digitCount = cleaned.replace(/\+/g, '').length;

  if (digitCount < ANTI_SPAM_CONFIG.PHONE_VALIDATION.MIN_DIGITS ||
      digitCount > ANTI_SPAM_CONFIG.PHONE_VALIDATION.MAX_DIGITS) {
    return null;
  }

  return cleaned;
}

function extractPhoneFromSegment(segment: string): string | null {
  const cleaned = segment.trim();
  if (!cleaned) return null;

  const hasDigits = /\d/.test(cleaned);
  if (!hasDigits) return null;

  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (digitCount < 8 || digitCount > 20) return null;

  return normalizePhone(cleaned);
}

export function extractUniquePhones(text: string): string[] {
  const delimiters = /[,;|\n\t]+/;
  const segments = text.split(delimiters);

  const candidates: string[] = [];

  for (const segment of segments) {
    let buffer = '';
    let digitCount = 0;
    let hasStarted = false;

    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];
      const isDigit = /\d/.test(char);
      const isPhoneChar = /[\d\+\-\(\)\.\s]/.test(char);

      if (isDigit) {
        buffer += char;
        digitCount++;
        hasStarted = true;
      } else if (isPhoneChar && (hasStarted || char === '+') && digitCount < 20) {
        buffer += char;
        if (char === '+' && !hasStarted) {
          hasStarted = true;
        }
      } else {
        if (digitCount >= 8 && buffer.trim()) {
          candidates.push(buffer.trim());
        }
        buffer = '';
        digitCount = 0;
        hasStarted = false;
      }
    }

    if (digitCount >= 8 && buffer.trim()) {
      candidates.push(buffer.trim());
    }
  }

  const normalized = new Set<string>();

  for (const candidate of candidates) {
    const norm = extractPhoneFromSegment(candidate);
    if (norm) {
      normalized.add(norm);
    }
  }

  const uniquePhones = Array.from(normalized);
  devLog('PHONE DEBUG', {
    text: text.slice(0, 100),
    candidates: candidates.length,
    uniquePhones,
    phone_count: uniquePhones.length
  });

  return uniquePhones;
}

export function countPhones(text: string): number {
  return extractUniquePhones(text).length;
}
