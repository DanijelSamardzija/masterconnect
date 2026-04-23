'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { GuestGateModal } from '@/components/guest-gate-modal';
import { saveGuestIntent, type GuestAction } from '@/lib/guest-intent';

interface GuestGateContextType {
  openGuestGate: (action: GuestAction, targetId?: string) => void;
}

const GuestGateContext = createContext<GuestGateContextType>({
  openGuestGate: () => {},
});

export function GuestGateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<GuestAction | undefined>();
  const pathname = usePathname();

  const openGuestGate = useCallback((action: GuestAction, targetId?: string) => {
    saveGuestIntent({ action, returnTo: pathname || '/', targetId });
    setCurrentAction(action);
    setOpen(true);
  }, [pathname]);

  return (
    <GuestGateContext.Provider value={{ openGuestGate }}>
      {children}
      <GuestGateModal open={open} onClose={() => setOpen(false)} action={currentAction} />
    </GuestGateContext.Provider>
  );
}

export function useGuestGate() {
  return useContext(GuestGateContext);
}
