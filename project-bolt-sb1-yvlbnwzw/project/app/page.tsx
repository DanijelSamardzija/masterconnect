import type { Metadata } from 'next';
import { hreflang } from '@/lib/i18n-config';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'GigZone – Platforma za profesionalce, usluge i poslove',
  description:
    'Objavite posao, pronađite profesionalce, ponudite usluge ili predstavite svoj rad. GigZone povezuje firme, freelancere, kreatore sadržaja i korisnike na jednom mjestu.',
  alternates: {
    canonical: 'https://www.gigzone.app',
    languages: hreflang(''),
  },
};

export default function Home() {
  return <HomeClient />;
}
