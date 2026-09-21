'use client';

import { TradeWorkerNav, type TradeWorkerTab } from '@/components/trade/TradeWorkerNav';

export function TradeWorkerLayout({
  profileId,
  active,
  children,
}: {
  profileId: string;
  active?: TradeWorkerTab;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <TradeWorkerNav profileId={profileId} active={active} />
        {children}
      </div>
    </div>
  );
}
