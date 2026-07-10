'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function UtmTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const source = searchParams.get('utm_source');
    if (!source) return;
    localStorage.setItem('utm_source', source);
    const medium = searchParams.get('utm_medium');
    const campaign = searchParams.get('utm_campaign');
    if (medium) localStorage.setItem('utm_medium', medium);
    if (campaign) localStorage.setItem('utm_campaign', campaign);
  }, [searchParams]);

  return null;
}
