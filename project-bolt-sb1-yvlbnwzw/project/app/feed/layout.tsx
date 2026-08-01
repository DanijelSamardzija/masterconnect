import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed — GigZone',
  description:
    'Pratite radove, objave i novosti profesionalaca na GigZone. Povežite se sa freelancerima, kreatorima sadržaja i stručnjacima iz vaše oblasti.',
  keywords: ['feed', 'objave', 'radovi', 'profesionalci', 'freelanceri', 'kreatori sadržaja', 'gigzone'],
  alternates: { canonical: 'https://www.gigzone.app/feed' },
  openGraph: {
    title: 'Feed — GigZone',
    description: 'Pratite radove i objave profesionalaca. Povežite se sa freelancerima i kreatorima sadržaja na GigZone.',
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
    title: 'Feed — GigZone',
    description: 'Pratite radove i objave profesionalaca na GigZone.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
