import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Usluge majstora i profesionalaca — GigZone',
  description:
    'Pronađite majstore, vodoinstalaere, električare, IT stručnjake i druge profesionalce. Brzo, jednostavno, pouzdano.',
  keywords: [
    'majstor', 'usluge', 'vodoinstalater', 'električar', 'moler', 'IT usluge',
    'services', 'professionals', 'freelance', 'skilled workers', 'gigzone',
  ],
  openGraph: {
    title: 'Usluge majstora i profesionalaca — GigZone',
    description: 'Pronađite majstore i profesionalce. Brzo, jednostavno, pouzdano.',
    url: 'https://www.gigzone.app/services',
    siteName: 'GigZone',
    type: 'website',
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
