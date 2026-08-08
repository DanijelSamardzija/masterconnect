import type { Metadata } from 'next';
import sr from '@/lib/translations/sr';

export const metadata: Metadata = {
  title: 'Pomoć i podrška — GigZone',
  description:
    'Pronađite odgovore na česta pitanja o GigZone platformi. Krediti, objave, usluge, poslovi i sve što trebate znati.',
  keywords: ['pomoć', 'podrška', 'FAQ', 'pitanja', 'uputstvo', 'gigzone'],
  alternates: { canonical: 'https://www.gigzone.app/help' },
  openGraph: {
    title: 'Pomoć i podrška — GigZone',
    description: 'Odgovori na česta pitanja o GigZone platformi — krediti, objave, usluge i poslovi.',
    url: 'https://www.gigzone.app/help',
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
    title: 'Pomoć i podrška — GigZone',
    description: 'Odgovori na česta pitanja o GigZone platformi.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: sr['help.faq.q1'], acceptedAnswer: { '@type': 'Answer', text: sr['help.faq.a1'] } },
    { '@type': 'Question', name: sr['help.faq.q2'], acceptedAnswer: { '@type': 'Answer', text: sr['help.faq.a2'] } },
    { '@type': 'Question', name: sr['help.faq.q3'], acceptedAnswer: { '@type': 'Answer', text: sr['help.faq.a3'] } },
    { '@type': 'Question', name: sr['help.faq.q4'], acceptedAnswer: { '@type': 'Answer', text: sr['help.faq.a4'] } },
    { '@type': 'Question', name: sr['help.faq.q5'], acceptedAnswer: { '@type': 'Answer', text: sr['help.faq.a5'] } },
  ],
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {children}
    </>
  );
}
