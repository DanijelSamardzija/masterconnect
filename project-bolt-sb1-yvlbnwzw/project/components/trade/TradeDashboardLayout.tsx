'use client';

import { TradeOwnerNav, type TradeOwnerTab } from '@/components/trade/TradeOwnerNav';

export function TradeDashboardLayout({
  profileId,
  active,
  children,
}: {
  profileId: string;
  active?: TradeOwnerTab;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <TradeOwnerNav profileId={profileId} active={active} />
        {children}
      </div>
    </div>
  );
}
