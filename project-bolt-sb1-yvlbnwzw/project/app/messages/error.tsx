'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Messages page error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-semibold text-foreground mb-2">Došlo je do greške</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Stranica poruka nije mogla da se učita. Pokušaj ponovo.
        </p>
        <Button onClick={reset} className="bg-orange-600 hover:bg-orange-700 text-white">
          Pokušaj ponovo
        </Button>
      </div>
    </div>
  );
}
