'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global error]', error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Došlo je do greške</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Nešto nije u redu. Pokušaj ponovo ili osvježi stranicu.
          </p>
          <button
            onClick={reset}
            style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Pokušaj ponovo
          </button>
        </div>
      </body>
    </html>
  );
}
