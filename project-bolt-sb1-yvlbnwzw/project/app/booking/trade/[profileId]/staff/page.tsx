'use client';

import { use, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { UserCog, Loader2 } from 'lucide-react';

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  primary_location_name: string | null;
  joined_at: string;
};

function roleLabel(t: (k: string) => string, role: string) {
  const key = `trade.dashboard.staff.role.${role}` as Parameters<typeof t>[0];
  return t(key);
}

export default function TradeStaffPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  async function loadStaff() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc('get_my_staff', {
      p_business_id: profileId,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else if (data?.ok === false) {
      setError(data.error ?? 'not_authorized');
    } else {
      setStaff(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="staff">
      <h1 className="text-lg font-bold text-foreground mb-4">{t('trade.dashboard.staff.title')}</h1>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      )}

      {!loading && !error && staff.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <UserCog className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('trade.dashboard.staff.empty')}</p>
        </div>
      )}

      {!loading && !error && staff.length > 0 && (
        <div className="flex flex-col gap-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card ${!member.is_active ? 'opacity-50' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{member.name || member.email}</p>
                {member.name && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
                {member.primary_location_name && (
                  <p className="text-xs text-muted-foreground truncate">{member.primary_location_name}</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${
                member.role === 'owner'
                  ? 'bg-primary/10 text-primary'
                  : member.role === 'manager'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {roleLabel(t, member.role)}
              </span>
            </div>
          ))}
        </div>
      )}
    </TradeDashboardLayout>
  );
}
