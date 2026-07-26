'use client';

import { Activity, BarChart2, Coins, Crown, ExternalLink, Loader2, RefreshCw, Sparkles, TrendingUp, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { timeAgo } from '@/lib/utils/date';
import { useRouter } from 'next/navigation';
import { CreditsStats } from '../types';

const TX_LABELS: Record<string, string> = {
  boost_post: '🚀 Boost',
  become_creator_premium: '⭐ Pro Premium',
  'Podrška poslata': '🧡 Podrži (poslato)',
  'Primljena podrška': '🧡 Podrži (primljeno)',
  'Nagrada: registration': '🎁 Registracija',
  'Nagrada: first_post': '🎁 Prvi post',
  'Nagrada: first_service': '🎁 Prva usluga',
  'Nagrada: first_job': '🎁 Posao',
  'Nagrada: profile_completed': '🎁 Profil',
  'Nagrada: referral': '🎁 Referral',
  'Post nagrada: slika': '📸 Slika',
  'Post nagrada: video': '🎥 Video',
};

function getTxLabel(desc: string): string {
  if (TX_LABELS[desc]) return TX_LABELS[desc];
  if (desc.startsWith('boost_post')) return '🚀 Boost';
  return desc || '—';
}

interface Props {
  creditsStats: CreditsStats | null;
  creditsLoading: boolean;
  creditsPeriod: number;
  onFetchStats: (days: number) => void;
}

export function CreditsTab({ creditsStats, creditsLoading, creditsPeriod, onFetchStats }: Props) {
  const router = useRouter();
  const periodLabel = creditsPeriod === 365 ? '1g' : `${creditsPeriod}d`;
  const periodLong = creditsPeriod === 365 ? '1 godina' : `${creditsPeriod} dana`;

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-foreground">Krediti &amp; Pro Premium</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
            {[{ days: 7, label: '7d' }, { days: 30, label: '30d' }, { days: 90, label: '90d' }, { days: 365, label: '1g' }].map(({ days, label }) => (
              <button
                key={days}
                onClick={() => onFetchStats(days)}
                className={`px-3 py-1.5 transition-colors ${creditsPeriod === days ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onFetchStats(creditsPeriod)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${creditsLoading ? 'animate-spin' : ''}`} />
            Osvježi
          </button>
        </div>
      </div>

      {creditsLoading && !creditsStats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : creditsStats ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ukupno kredita u opticaju', value: creditsStats.totalBalance, icon: <Coins className="h-4 w-4 text-orange-500" />, color: 'text-orange-500' },
              { label: 'Pro Premium korisnika', value: creditsStats.premiumCount, icon: <Crown className="h-4 w-4 text-amber-500" />, color: 'text-amber-500' },
              { label: `Transakcija (${periodLabel})`, value: creditsStats.txCount, icon: <TrendingUp className="h-4 w-4 text-blue-500" />, color: 'text-blue-500' },
              { label: `Zarada sajta (${periodLabel})`, value: `${creditsStats.platformEarnings} kr`, icon: <Sparkles className="h-4 w-4 text-green-500" />, color: 'text-green-500' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm">Gdje korisnici troše/zarađuju ({periodLong})</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'podrzi', label: '🧡 Podrži dugme', color: 'bg-orange-100 text-orange-700' },
                { key: 'boost', label: '🚀 Boost postova', color: 'bg-purple-100 text-purple-700' },
                { key: 'creator_premium', label: '⭐ Pro Premium', color: 'bg-amber-100 text-amber-700' },
                { key: 'nagrada', label: '🎁 Nagrade (onboarding)', color: 'bg-green-100 text-green-700' },
                { key: 'media_nagrada', label: '📸 Media nagrade', color: 'bg-blue-100 text-blue-700' },
                { key: 'referral', label: '🔗 Referral nagrade', color: 'bg-pink-100 text-pink-700' },
                { key: 'ostalo', label: '📦 Ostalo', color: 'bg-slate-100 text-slate-700' },
              ].map(({ key, label, color }) => {
                const d = creditsStats.breakdown?.[key] || { count: 0, total: 0 };
                return (
                  <div key={key} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                    <p className="text-lg font-bold text-foreground">
                      {d.count} <span className="text-xs font-normal text-muted-foreground">transakcija</span>
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{d.total} kredita</span>
                  </div>
                );
              })}
            </div>
            {creditsStats.platformEarnings > 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
                <Sparkles className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-xs text-green-800 dark:text-green-300">
                  Sajt je zaradio <span className="font-bold">{creditsStats.platformEarnings} kredita</span> od provizija u ovom periodu
                  {creditsStats.breakdown?.podrzi?.count > 0 && ` (${creditsStats.breakdown.podrzi.count} × 15% naknada)`}
                </span>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm">Transakcije ({periodLong})</h3>
            </div>
            <div className="space-y-2">
              {creditsStats.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nema transakcija</p>
              ) : creditsStats.recent.map((tx, i) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={tx.profile?.avatar_url} />
                      <AvatarFallback className="text-[10px]">{tx.profile?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{tx.profile?.name || 'Nepoznat'}</p>
                      <p className="text-[10px] text-muted-foreground">{getTxLabel(tx.description || '')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{tx.amount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(tx.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referrals */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Referral pozivi — {periodLong} ({creditsStats.referralTotal})</h3>
              </div>
            </div>
            {creditsStats.topReferrers?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top pozivači</p>
                <div className="space-y-2">
                  {creditsStats.topReferrers.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={r.avatar_url} />
                        <AvatarFallback className="text-[10px]">{r.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-semibold flex-1">{r.name}</p>
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                        {r.count} poziva
                      </span>
                      <button
                        onClick={() => router.push(`/profile/${r.id}`)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs font-semibold text-muted-foreground mb-2">Posljednji pozivi</p>
            {creditsStats.referrals?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema referrala još</p>
            ) : (
              <div className="space-y-2">
                {creditsStats.referrals?.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        <span className="text-blue-600">{r.referrer?.name || '—'}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span>{r.referred?.name || '—'}</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0">{timeAgo(r.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Premium users */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Pro Premium korisnici ({creditsStats.premiumCount})</h3>
            </div>
            {creditsStats.premiumUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nema Premium korisnika</p>
            ) : (
              <div className="space-y-2">
                {creditsStats.premiumUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="text-[10px]">{u.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-semibold flex-1">{u.name}</p>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                      ⭐ Creator
                    </span>
                    <button
                      onClick={() => router.push(`/profile/${u.id}`)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          Klikni Osvježi za učitavanje podataka
        </div>
      )}
    </div>
  );
}
