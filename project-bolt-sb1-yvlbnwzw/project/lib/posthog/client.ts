type PostHogType = typeof import('posthog-js').default;

let phInstance: PostHogType | null = null;
let phPromise: Promise<PostHogType> | null = null;

export function getPostHog(): Promise<PostHogType> {
  if (phInstance) return Promise.resolve(phInstance);
  if (!phPromise) {
    phPromise = import('posthog-js').then(({ default: posthog }) => {
      if (!phInstance) {
        posthog.init('phc_x3wZDZJh7G4oq8A5LffT2raWGQifq3vHTskZgoiV8yxZ', {
          api_host: 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false,
        });
        phInstance = posthog;
      }
      return phInstance!;
    });
  }
  return phPromise;
}
