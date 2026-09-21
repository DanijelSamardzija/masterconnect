'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkerIndexPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/booking/trade/${profileId}/worker/jobs`);
  }, [profileId, router]);

  return null;
}
