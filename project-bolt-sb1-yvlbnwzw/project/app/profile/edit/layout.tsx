import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Uredi profil — GigZone',
  description: 'Uredite informacije o vašem GigZone profilu, kontakt podatke i postavke privatnosti.',
  robots: { index: false, follow: false },
};
export default function ProfileEditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
