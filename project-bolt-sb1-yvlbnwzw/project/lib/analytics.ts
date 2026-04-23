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
