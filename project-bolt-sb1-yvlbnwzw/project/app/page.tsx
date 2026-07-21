import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'GigZone - Platforma za majstore i poslove',
  description:
    'Pronađite majstore, objavite poslove ili ponudite svoje usluge. Marketplace koji povezuje korisnike, pružaoce usluga i tražioce poslova u ex-YU zajednici.',
  alternates: {
    canonical: 'https://www.gigzone.app',
  },
};

export default function Home() {
  return <HomeClient />;
}
