'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TradeSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/booking/business/setup');
  }, [router]);
  return null;
}
