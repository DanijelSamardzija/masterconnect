'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { MyAnalyticsView } from '@/components/booking/my-analytics-view';
import { StaffBookingNav } from '@/components/booking/staff-booking-nav';

function MyAnalyticsInner() {
  return <MyAnalyticsView nav={<StaffBookingNav active="my-analytics" />} />;
}

export default function StaffMyAnalyticsPage() {
  return (
    <ProtectedRoute>
      <MyAnalyticsInner />
    </ProtectedRoute>
  );
}
