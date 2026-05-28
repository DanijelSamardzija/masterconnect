import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed — GigZone',
  description:
    'Pratite novosti, radove i objave majstora i profesionalaca iz ex-YU zajednice u zemlji i dijaspori.',
  keywords: [
    'majstori', 'radovi', 'profesionalci', 'dijaspora', 'Srbija', 'Bosna', 'Hrvatska',
    'Austrija', 'Njemačka', 'gigzone',
  ],
  openGraph: {
    title: 'Feed — GigZone',
    description: 'Novosti i objave iz zajednice profesionalaca na GigZone.',
    url: 'https://www.gigzone.app/feed',
    siteName: 'GigZone',
    type: 'website',
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
