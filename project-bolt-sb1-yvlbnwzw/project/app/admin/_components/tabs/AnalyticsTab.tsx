'use client';

import { Activity, BarChart2, CalendarDays, Loader2, MapPin, RefreshCw, Sparkles, TrendingUp, Users } from 'lucide-react';
import { AnalyticsCard } from '../analytics/AnalyticsCard';
import { AnalyticsBarRow } from '../analytics/AnalyticsBarRow';
import { AnalyticsBarChart } from '../analytics/AnalyticsBarChart';
import { AnalyticsSection } from '../analytics/AnalyticsSection';
import { AnalyticsData, InvestStats } from '../types';
import { timeAgo } from '@/lib/utils/date';

interface Props {
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
  selectedYear: number;
  investStats: InvestStats | null;
  investLoading: boolean;
  onFetchAnalytics: (year: number) => void;
  onYearChange: (year: number) => void;
  onFetchInvestStats: () => void;
}

const INVEST_ROLE_LABELS: Record<string, string> = {
  investor: 'Investitor',
  business_owner: 'Vlasnik biznisa',
  startup_founder: 'Osnivač startapa',
  service_business: 'Servisni biznis',
};

const INVEST_ROLE_COLORS: Record<string, string> = {
  investor: 'bg-orange-500',
  business_owner: 'bg-blue-500',
  startup_founder: 'bg-purple-500',
  service_business: 'bg-emerald-500',
};

const SIGNUP_SOURCE_COLORS: Record<string, string> = {
  join_page: 'bg-orange-500',
  homepage: 'bg-blue-500',
  guest_gate: 'bg-purple-500',
  direct: 'bg-slate-400',
};

const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  join_page: 'Join stranica',
  homepage: 'Početna',
  guest_gate: 'Guest gate',
  direct: 'Direktno',
};

const UTM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  google: 'bg-yellow-500',
  tiktok: 'bg-slate-800',
};

const UTM_ICONS: Record<string, string> = {
  facebook: '📘',
  instagram: '📸',
  google: '🔍',
  tiktok: '🎵',
};

export function AnalyticsTab({
  analytics,
  analyticsLoading,
  selectedYear,
  investStats,
  investLoading,
  onFetchAnalytics,
  onYearChange,
  onFetchInvestStats,
}: Props) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2025 + i);

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Godina:</span>
        <div className="flex gap-2 flex-wrap">
          {years.map(year => (
            <button
              key={year}
              onClick={() => {
                onYearChange(year);
                onFetchAnalytics(year);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedYear === year
                  ? 'bg-orange-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : analytics ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Aktivni danas', value: analytics.dau, icon: Activity, color: 'text-green-500' },
              { label: 'Aktivni (7 dana)', value: analytics.wau, icon: TrendingUp, color: 'text-blue-500' },
              { label: 'Aktivni (30 dana)', value: analytics.mau, icon: Users, color: 'text-purple-500' },
              { label: 'Aktivni (godišnje)', value: analytics.yau, icon: TrendingUp, color: 'text-indigo-500' },
              { label: 'Novi ove sedmice', value: analytics.newUsersThisWeek, icon: CalendarDays, color: 'text-orange-500' },
              { label: 'Novi ovog mjeseca', value: analytics.newUsersThisMonth, icon: CalendarDays, color: 'text-pink-500' },
              { label: 'Novi ove godine', value: analytics.newUsersThisYear, icon: CalendarDays, color: 'text-rose-500' },
            ].map(({ label, value, icon, color }) => (
              <AnalyticsCard key={label} icon={icon} value={value} label={label} color={color} />
            ))}
          </div>

          {/* Page views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={BarChart2} title="Pregledi po stranicama">
              {analytics.pageViews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
              ) : (
                <div className="space-y-2">
                  {analytics.pageViews.map(({ page, count }) => (
                    <AnalyticsBarRow
                      key={page}
                      label={page}
                      count={count}
                      maxCount={analytics.pageViews[0]?.count || 1}
                    />
                  ))}
                </div>
              )}
            </AnalyticsSection>
          </div>

          {/* Cities and Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={MapPin} iconColor="text-blue-500" title="Korisnici po gradovima">
              {analytics.topCities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {analytics.topCities.map(({ city, count }) => (
                    <AnalyticsBarRow
                      key={city}
                      label={city}
                      count={count}
                      maxCount={analytics.topCities[0]?.count || 1}
                      color="bg-blue-500"
                    />
                  ))}
                </div>
              )}
            </AnalyticsSection>

            <AnalyticsSection icon={MapPin} iconColor="text-purple-500" title="Korisnici po državama">
              {analytics.topCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka — korisnici još nisu unijeli državu</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {analytics.topCountries.map(({ country, count }) => (
                    <AnalyticsBarRow
                      key={country}
                      label={country}
                      count={count}
                      maxCount={analytics.topCountries[0]?.count || 1}
                      color="bg-purple-500"
                    />
                  ))}
                </div>
              )}
            </AnalyticsSection>
          </div>

          {/* Monthly charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={CalendarDays} title={`Novi korisnici — ${selectedYear}.`}>
              <AnalyticsBarChart
                color="bg-orange-500"
                data={analytics.monthlyNewUsers.map(({ month, count }) => ({
                  key: month,
                  label: new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' }),
                  tooltip: `${count} novih`,
                  count,
                }))}
              />
            </AnalyticsSection>

            <AnalyticsSection icon={Activity} iconColor="text-indigo-500" title={`Aktivni korisnici — ${selectedYear}.`}>
              <AnalyticsBarChart
                color="bg-indigo-500"
                data={analytics.monthlyActiveUsers.map(({ month, count }) => ({
                  key: month,
                  label: new Date(month + '-01').toLocaleDateString('sr-RS', { month: 'short' }),
                  tooltip: `${count} aktivnih`,
                  count,
                }))}
              />
            </AnalyticsSection>
          </div>

          {/* Signup sources + UTM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={TrendingUp} title="Registracije po izvoru">
              {analytics.signupSources.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
              ) : (
                <div className="space-y-2">
                  {analytics.signupSources.map(({ source, count }) => {
                    const total = analytics.signupSources.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{SIGNUP_SOURCE_LABELS[source] || source}</span>
                          <span className="text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${SIGNUP_SOURCE_COLORS[source] || 'bg-slate-500'} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AnalyticsSection>

            <AnalyticsSection icon={Sparkles} iconColor="text-blue-500" title="Registracije iz reklama (UTM)">
              {!analytics.utmSources || analytics.utmSources.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nema podataka — dodaj <code className="text-xs bg-muted px-1 rounded">?utm_source=facebook</code> na link u reklami
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.utmSources.map(({ source, count }) => {
                    const total = analytics.utmSources.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{UTM_ICONS[source] || '📣'} {source}</span>
                          <span className="text-muted-foreground">{count} korisnika ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${UTM_COLORS[source] || 'bg-orange-500'} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Ukupno kroz reklame: {analytics.utmSources.reduce((s, x) => s + x.count, 0)} korisnika
                  </p>
                </div>
              )}
            </AnalyticsSection>
          </div>

          {/* Daily charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalyticsSection icon={Users} iconColor="text-emerald-500" title="Novi korisnici — zadnjih 30 dana">
              <AnalyticsBarChart
                color="bg-emerald-500"
                barHeightPx={90}
                gap="gap-0.5"
                showLabels={false}
                data={analytics.dailyNewUsers.map(({ date, count }) => ({
                  key: date,
                  tooltip: `${count} — ${date.slice(5)}`,
                  count,
                  minHeightPct: 4,
                }))}
              />
              <p className="text-[10px] text-muted-foreground text-center">Hover za detalje · svaki stub = 1 dan</p>
            </AnalyticsSection>

            <AnalyticsSection
              icon={Activity}
              iconColor="text-green-500"
              title="Aktivni korisnici — zadnjih 7 dana"
              action={
                <button
                  onClick={() => onFetchAnalytics(selectedYear)}
                  className="text-xs text-orange-500 hover:underline"
                >
                  Osvježi
                </button>
              }
            >
              {analytics.dailyActiveUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nema podataka</p>
              ) : (
                <AnalyticsBarChart
                  color="bg-green-500"
                  barHeightPx={100}
                  data={analytics.dailyActiveUsers.map(({ date, count }) => ({
                    key: date,
                    label: new Date(date).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'numeric' }),
                    tooltip: `${count} korisnika`,
                    count,
                  }))}
                />
              )}
            </AnalyticsSection>
          </div>

          {/* Invest analytics */}
          <div className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-sm text-foreground">Invest — Lista čekanja</h3>
              </div>
              <button
                onClick={onFetchInvestStats}
                className="text-xs text-orange-500 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Osvježi
              </button>
            </div>

            {investLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              </div>
            ) : investStats ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Ukupno na listi', value: investStats.waitlistTotal, color: 'text-orange-500' },
                    { label: 'Ukupno interesa', value: investStats.interestsTotal, color: 'text-blue-500' },
                    { label: 'Projekata', value: investStats.projectsTotal, color: 'text-purple-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                      <p className={`text-2xl font-black ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Role breakdown */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Po ulozi</h4>
                  {investStats.byRole.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nema podataka</p>
                  ) : (
                    <div className="space-y-2">
                      {investStats.byRole.map(({ role, count }) => {
                        const pct = investStats.waitlistTotal > 0
                          ? Math.round((count / investStats.waitlistTotal) * 100)
                          : 0;
                        return (
                          <div key={role}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{INVEST_ROLE_LABELS[role] || role}</span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${INVEST_ROLE_COLORS[role] || 'bg-slate-500'} rounded-full`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent signups */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zadnjih 8 prijava</h4>
                  {investStats.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nema prijava</p>
                  ) : (
                    <div className="space-y-2">
                      {investStats.recent.map((w, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{w.email}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
                              {INVEST_ROLE_LABELS[w.role] || w.role}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(w.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <button onClick={onFetchInvestStats} className="text-orange-500 hover:underline">
                  Učitaj invest podatke
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Kliknite na tab za učitavanje analitike
        </div>
      )}
    </div>
  );
}
