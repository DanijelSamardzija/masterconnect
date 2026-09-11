// Temporary beta whitelist — remove this file when Booking exits beta testing.
// To restore full access: delete this file and remove all imports of isBookingBetaUser.
export const BOOKING_BETA_USERS = [
  '1fa3b3fb-9fcc-43fe-a242-3415d7119a75', // Danijel — owner/business flow
  '3bddb236-a206-452f-8734-cfab73973161', // Zoran — client/booking flow
] as const;

export function isBookingBetaUser(userId?: string | null): boolean {
  return !!userId && (BOOKING_BETA_USERS as readonly string[]).includes(userId);
}
