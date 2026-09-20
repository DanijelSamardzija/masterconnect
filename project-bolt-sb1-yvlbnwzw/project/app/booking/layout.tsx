import type { Metadata } from 'next';
import { BookingProfileProvider } from '@/lib/contexts/booking-profile-context';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <BookingProfileProvider>{children}</BookingProfileProvider>;
}
