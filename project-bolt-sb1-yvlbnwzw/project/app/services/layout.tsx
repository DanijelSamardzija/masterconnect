import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Usluge majstora i profesionalaca — GigZone',
  description:
    'Pronađite majstore, vodoinstalaere, električare, IT stručnjake i druge profesionalce. Objave iz Srbije, Bosne, Hrvatske, Austrije i Njemačke.',
  keywords: [
    'majstor', 'usluge', 'vodoinstalater', 'električar', 'moler', 'IT usluge',
    'Beograd', 'Novi Sad', 'Zagreb', 'Sarajevo', 'Beč', 'Berlin', 'gigzone',
  ],
  openGraph: {
    title: 'Usluge majstora i profesionalaca — GigZone',
    description: 'Pronađite majstore i profesionalce iz ex-YU dijaspore.',
    url: 'https://www.gigzone.app/services',
    siteName: 'GigZone',
    type: 'website',
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
