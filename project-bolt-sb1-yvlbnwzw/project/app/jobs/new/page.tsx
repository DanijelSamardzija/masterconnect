'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function JobsNewRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/jobs');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-slate-600">Redirecting to Jobs Marketplace...</p>
        </CardContent>
      </Card>
    </div>
  );
}
