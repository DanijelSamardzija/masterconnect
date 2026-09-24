'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TradeStaffRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/booking/business/setup?tab=staff');
  }, [router]);
  return null;
}
