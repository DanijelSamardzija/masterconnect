// Beta testing ended — booking is now available to all users.
export const BOOKING_BETA_USERS: readonly string[] = [];

export function isBookingBetaUser(_userId?: string | null): boolean {
  return true;
}
