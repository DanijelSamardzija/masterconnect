import { ANTI_SPAM_CONFIG } from './config';
import { extractUniquePhones, countPhones as countUniquePhones } from './phones';
import { devLog } from '@/lib/dev-log';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export interface LinkDebugInfo {
  rawCount: number;
  rawMatches: string[];
  normalizedCount: number;
  normalized: string[];
  uniqueCount: number;
  uniqueLinks: string[];
}

let lastLinkDebug: LinkDebugInfo | null = null;

export function getLastLinkDebug(): LinkDebugInfo | null {
  return lastLinkDebug;
}

export function countLinks(text: string): number {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  const rawMatches = [...text.matchAll(urlRegex)];
  const rawLinks = rawMatches.map(m => m[0]);

  const normalize = (u: string) =>
    u.trim()
     .replace(/[),.;!?]+$/g, '')
     .toLowerCase();

  const normalized = rawLinks.map(normalize);
  const uniqueLinks = Array.from(new Set(normalized));

  lastLinkDebug = {
    rawCount: rawMatches.length,
    rawMatches: rawLinks,
    normalizedCount: normalized.length,
    normalized: normalized,
    uniqueCount: uniqueLinks.length,
    uniqueLinks: uniqueLinks
  };

  devLog('[LINK DEBUG]', lastLinkDebug);

  return uniqueLinks.length;
}

export function extractPhones(text: string): string[] {
  return extractUniquePhones(text);
}

export function countPhones(text: string): number {
  return countUniquePhones(text);
}

export function hashtagCount(text: string): number {
  const hashtags = text.match(/#\w+/g);
  return hashtags ? hashtags.length : 0;
}

export function capsRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');

  if (letters.length < ANTI_SPAM_CONFIG.THRESHOLDS.MIN_LETTERS_FOR_CAPS) {
    return 0;
  }

  const uppercaseCount = text.replace(/[^A-Z]/g, '').length;
  return uppercaseCount / letters.length;
}

export function duplicateHash(normalizedText: string): string {
  let hash = 0;
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
