import { getPostHog } from '@/lib/posthog/client';

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  getPostHog().then(posthog => posthog.capture(name, properties)).catch(() => {});
}

export function identifyUser(userId: string, email?: string) {
  if (typeof window === 'undefined') return;
  getPostHog().then(posthog => posthog.identify(userId, { email })).catch(() => {});
}

export function saveAnonymousId() {
  if (typeof window === 'undefined') return;
  getPostHog().then(posthog => {
    const anonId = posthog.get_distinct_id();
    if (anonId) localStorage.setItem('ph_pre_oauth_id', anonId);
  }).catch(() => {});
}

export function aliasPreOAuthSession() {
  if (typeof window === 'undefined') return;
  getPostHog().then(posthog => {
    const anonId = localStorage.getItem('ph_pre_oauth_id');
    if (anonId) {
      posthog.alias(anonId);
      localStorage.removeItem('ph_pre_oauth_id');
    }
  }).catch(() => {});
}
