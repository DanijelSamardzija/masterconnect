import posthog from 'posthog-js';

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  try {
    if (typeof window !== 'undefined') {
      posthog.capture(name, properties);
    }
  } catch {
    // Silently fail
  }
}

export function identifyUser(userId: string, email?: string) {
  try {
    if (typeof window !== 'undefined') {
      posthog.identify(userId, { email });
    }
  } catch {
    // Silently fail
  }
}

export function saveAnonymousId() {
  try {
    if (typeof window !== 'undefined') {
      const anonId = posthog.get_distinct_id();
      if (anonId) {
        localStorage.setItem('ph_pre_oauth_id', anonId);
      }
    }
  } catch {
    // Silently fail
  }
}

export function aliasPreOAuthSession() {
  try {
    if (typeof window !== 'undefined') {
      const anonId = localStorage.getItem('ph_pre_oauth_id');
      if (anonId) {
        posthog.alias(anonId);
        localStorage.removeItem('ph_pre_oauth_id');
      }
    }
  } catch {
    // Silently fail
  }
}
