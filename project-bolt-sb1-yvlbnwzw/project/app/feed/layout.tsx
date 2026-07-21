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
    images: [
      {
        url: 'https://www.gigzone.app/icon-512.png',
        width: 512,
        height: 512,
        alt: 'GigZone logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
