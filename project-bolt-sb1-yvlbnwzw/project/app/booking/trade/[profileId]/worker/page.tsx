'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function WorkerIndexPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = useParams() as { profileId: string };
  const router = useRouter();

  useEffect(() => {
    router.replace(`/booking/trade/${profileId}/worker/jobs`);
  }, [profileId, router]);

  return null;
}
