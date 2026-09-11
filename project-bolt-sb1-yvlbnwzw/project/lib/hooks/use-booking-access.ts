import { useAuth } from '@/lib/contexts/auth-context';
import { isBookingBetaUser } from '@/lib/booking-whitelist';

export function useBookingAccess() {
  const { user, loading } = useAuth();
  return {
    hasAccess: isBookingBetaUser(user?.id),
    loading,
  };
}
