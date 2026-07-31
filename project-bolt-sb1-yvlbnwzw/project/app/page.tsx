import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'GigZone – Platforma za profesionalce, usluge i poslove',
  description:
    'Objavite posao, pronađite profesionalce, ponudite usluge ili predstavite svoj rad. GigZone povezuje firme, freelancere, kreatore sadržaja i korisnike na jednom mjestu.',
  alternates: {
    canonical: 'https://www.gigzone.app',
  },
};

export default function Home() {
  return <HomeClient />;
}
