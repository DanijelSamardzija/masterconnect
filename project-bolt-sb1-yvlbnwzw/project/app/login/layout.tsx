import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Prijava — GigZone',
  description: 'Prijavite se na GigZone i pronađite profesionalce, usluge ili poslove.',
  robots: { index: false, follow: false },
};
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
