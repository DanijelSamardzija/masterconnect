export type GuestAction =
  | 'like'
  | 'comment'
  | 'message'
  | 'apply'
  | 'follow'
  | 'post'
  | 'phone'
  | 'save'
  | 'contact';

export interface GuestIntent {
  action: GuestAction;
  returnTo: string;
  targetId?: string;
}

const KEY = 'guest_intent';

export function saveGuestIntent(intent: GuestIntent) {
  try { localStorage.setItem(KEY, JSON.stringify(intent)); } catch {}
}

export function getGuestIntent(): GuestIntent | null {
  try {
    const val = localStorage.getItem(KEY);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export function clearGuestIntent() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Pozovi posle uspešne registracije/logina da vratiš korisnika
export function resumeAfterAuth(router: { push: (url: string) => void }) {
  const intent = getGuestIntent();
  clearGuestIntent();
  router.push(intent?.returnTo || '/feed');
}
