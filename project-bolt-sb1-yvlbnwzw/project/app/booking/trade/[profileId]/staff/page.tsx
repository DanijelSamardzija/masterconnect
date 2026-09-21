'use client';

import { use, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { UserCog, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TradePermissions = {
  can_create_manual_jobs:   boolean;
  can_view_client_records:  boolean;
  can_edit_client_records:  boolean;
  can_create_job_reports:   boolean;
  can_add_materials:        boolean;
  can_view_financials:      boolean;
  can_view_purchase_prices: boolean;
  can_handle_emergency:     boolean;
  can_accept_emergency:     boolean;
};

const TRADE_PERM_KEYS: (keyof TradePermissions)[] = [
  'can_create_manual_jobs',
  'can_view_client_records',
  'can_edit_client_records',
  'can_create_job_reports',
  'can_add_materials',
  'can_view_financials',
  'can_view_purchase_prices',
  'can_handle_emergency',
  'can_accept_emergency',
];

const EMPTY_PERMS: TradePermissions = {
  can_create_manual_jobs:   false,
  can_view_client_records:  false,
  can_edit_client_records:  false,
  can_create_job_reports:   false,
  can_add_materials:        false,
  can_view_financials:      false,
  can_view_purchase_prices: false,
  can_handle_emergency:     false,
  can_accept_emergency:     false,
};

type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions: TradePermissions;
};

function roleLabel(t: (k: string) => string, role: string) {
  return t(`trade.dashboard.staff.role.${role}` as Parameters<typeof t>[0]);
}

function extractTradePerms(raw: Record<string, unknown>): TradePermissions {
  const perms = { ...EMPTY_PERMS };
  for (const key of TRADE_PERM_KEYS) {
    perms[key] = !!(raw?.[key]);
  }
  return perms;
}

// ─── Permission editor ────────────────────────────────────────────────────────

function PermissionEditor({
  staffId,
  name,
  initialPerms,
  profileId,
  onSaved,
  t,
}: {
  staffId: string;
  name: string;
  initialPerms: TradePermissions;
  profileId: string;
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [perms, setPerms] = useState<TradePermissions>(initialPerms);
  const [saving, setSaving] = useState(false);

  function toggle(key: keyof TradePermissions) {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  }

  async function save() {
    setSaving(true);
    const { data } = await (supabase as any).rpc('update_trade_staff_permissions', {
      p_business_id: profileId,
      p_staff_id:    staffId,
      p_permissions: perms,
    });
    if (data?.ok) {
      toast.success(t('trade.staff.permissions.saved'));
      onSaved();
    } else {
      toast.error(data?.error ?? 'error');
    }
    setSaving(false);
  }

  return (
    <div className="border-t border-border pt-3 mt-2 flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t('trade.staff.permissions.title')}
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {TRADE_PERM_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={perms[key]}
              onChange={() => toggle(key)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-xs text-foreground">
              {t(`trade.staff.permissions.${key}` as Parameters<typeof t>[0])}
            </span>
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {t('trade.staff.permissions.save')}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeStaffPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  async function loadStaff() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc('get_trade_staff', {
      p_business_id: profileId,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else if (data?.ok === false) {
      setError(data.error ?? 'not_authorized');
    } else {
      const members = (Array.isArray(data) ? data : []).map(
        (m: StaffMember & { permissions: Record<string, unknown> }) => ({
          ...m,
          permissions: extractTradePerms(m.permissions ?? {}),
        }),
      );
      setStaff(members);
    }
    setLoading(false);
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="staff">
      <h1 className="text-lg font-bold text-foreground mb-4">
        {t('trade.dashboard.staff.title')}
      </h1>

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
          <p className="text-sm text-muted-foreground">
            {t('trade.dashboard.staff.empty')}
          </p>
        </div>
      )}

      {!loading && !error && staff.length > 0 && (
        <div className="flex flex-col gap-2">
          {staff.map((member) => {
            const isExpanded = expanded === member.id;
            const isOwner = member.role === 'owner';
            return (
              <div
                key={member.id}
                className={`rounded-xl border border-border bg-card overflow-hidden ${
                  !member.is_active ? 'opacity-50' : ''
                }`}
              >
                {/* Member row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                    <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name || member.email}
                    </p>
                    {member.name && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${
                      member.role === 'owner'
                        ? 'bg-primary/10 text-primary'
                        : member.role === 'manager'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {roleLabel(t, member.role)}
                  </span>
                  {/* Expand toggle — only for non-owner workers/managers */}
                  {!isOwner && member.is_active && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : member.id)}
                      className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded permissions editor */}
                {isExpanded && !isOwner && (
                  <div className="px-3 pb-3">
                    <PermissionEditor
                      staffId={member.id}
                      name={member.name || member.email}
                      initialPerms={member.permissions}
                      profileId={profileId}
                      onSaved={loadStaff}
                      t={t}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </TradeDashboardLayout>
  );
}
