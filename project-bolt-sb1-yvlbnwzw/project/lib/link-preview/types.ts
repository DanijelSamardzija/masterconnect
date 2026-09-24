export type PreviewData = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  domain: string;
  /** Resolver that produced this data — for future use (analytics, styling, OG sharing). */
  internalType?: 'booking-termini' | 'majstori' | 'booking-service' | 'post' | 'profile' | 'job' | 'service' | 'external';
};
