'use client';

import { useEffect, useState, useCallback } from 'react';
import { Brain, RefreshCw, Loader2, TrendingUp, Zap, DollarSign, Timer, Database } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface MatchStats {
  total_runs:           number;
  cache_hits:           number;
  cache_hit_rate_pct:   number;
  total_cost_usd:       number;
  avg_duration_ms:      number;
  total_input_tokens:   number;
  total_output_tokens:  number;
  runs_last_7d:         number;
  runs_last_30d:        number;
  top_categories:       Array<{ category: string; count: number }>;
}

interface RecentRun {
  id:            string;
  post_id:       string | null;
  user_id:       string;
  cache_hit:     boolean;
  cost_usd:      number | null;
  duration_ms:   number | null;
  post_type:     string | null;
  category:      string | null;
  pipeline_type: string | null;
  created_at:    string;
}

export function AiMatchTab() {
  const [stats, setStats]             = useState<MatchStats | null>(null);
  const [recentRuns, setRecentRuns]   = useState<RecentRun[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: statsData, error: statsErr } = await (supabase as any)
        .rpc('get_matchmaking_stats')

      if (statsErr) throw new Error(statsErr.message);

      const { data: runs, error: runsErr } = await (supabase as any)
        .rpc('get_recent_matchmaking_runs', { p_limit: 20 })

      if (runsErr) throw new Error(runsErr.message);

      setStats(statsData as unknown as MatchStats);
      setRecentRuns((runs ?? []) as RecentRun[]);
    } catch (e: any) {
      setError(e?.message ?? 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {error}
        <button onClick={fetchData} className="ml-2 text-orange-500 hover:underline">Pokušaj ponovo</button>
      </div>
    );
  }

  const statCards = stats ? [
    {
      icon: <TrendingUp className="h-4 w-4 text-orange-500" />,
      label: 'Ukupno runova',
      value: stats.total_runs.toLocaleString(),
    },
    {
      icon: <Database className="h-4 w-4 text-blue-500" />,
      label: 'Cache hit rate',
      value: `${stats.cache_hit_rate_pct ?? 0}%`,
    },
    {
      icon: <DollarSign className="h-4 w-4 text-green-500" />,
      label: 'Ukupni trošak',
      value: `$${stats.total_cost_usd}`,
    },
    {
      icon: <Timer className="h-4 w-4 text-purple-500" />,
      label: 'Prosj. trajanje',
      value: stats.avg_duration_ms ? `${stats.avg_duration_ms}ms` : '—',
    },
    {
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      label: 'Runovi (7d)',
      value: stats.runs_last_7d.toLocaleString(),
    },
    {
      icon: <Brain className="h-4 w-4 text-orange-500" />,
      label: 'Runovi (30d)',
      value: stats.runs_last_30d.toLocaleString(),
    },
  ] : [];

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-orange-500" />
          AI Matchmaking — Statistike
        </h2>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Osvježi
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map(({ icon, label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
              <div className="text-lg font-bold text-foreground">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Token usage */}
      {stats && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Token potrošnja (ukupno)</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Input: </span>
              <span className="font-semibold">{(stats.total_input_tokens ?? 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Output: </span>
              <span className="font-semibold">{(stats.total_output_tokens ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Top categories */}
      {stats?.top_categories && stats.top_categories.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top kategorije</h3>
          <div className="space-y-2">
            {stats.top_categories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{cat.category || '—'}</span>
                <span className="text-muted-foreground font-mono">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent runs */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Posljednji runovi</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Tip</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Kategorija</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Cache</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Trošak</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Trajanje</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-foreground">{run.pipeline_type ?? run.post_type ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{run.category ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        run.cache_hit
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {run.cache_hit ? 'HIT' : 'MISS'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                      {run.cost_usd != null ? `$${run.cost_usd.toFixed(5)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                      {run.duration_ms != null ? `${run.duration_ms}ms` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {new Date(run.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {recentRuns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nema runova.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
