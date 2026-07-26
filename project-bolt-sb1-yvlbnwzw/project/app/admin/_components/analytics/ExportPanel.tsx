'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { downloadCSV } from '../utils/csv';
import type { AnalyticsData } from '../types';

interface Props {
  analytics: AnalyticsData | null;
}

type ExportKey = 'users' | 'posts' | 'geo' | 'utm' | 'reports';

const EXPORTS: { key: ExportKey; label: string; sublabel: string }[] = [
  { key: 'users',   label: 'Korisnici',  sublabel: 'Ime, email, tip, grad, zemlja, datum' },
  { key: 'posts',   label: 'Postovi',    sublabel: 'ID, sadržaj, tip, status, pregledi, datum' },
  { key: 'geo',     label: 'Geografija', sublabel: 'Gradovi i države s brojem korisnika' },
  { key: 'utm',     label: 'UTM podaci', sublabel: 'Izvori, kampanje i mediji' },
  { key: 'reports', label: 'Reportovi',  sublabel: 'Svi reportovi s razlogom i statusom' },
];

const EMPTY_MSG: Record<ExportKey, string> = {
  users:   'Nema korisnika za export',
  posts:   'Nema postova za export',
  geo:     'Nema geografskih podataka — korisnici nemaju unetu lokaciju',
  utm:     'Nema UTM podataka — dodaj ?utm_source= na linkove u reklamama',
  reports: 'Nema reportova za export',
};

export function ExportPanel({ analytics }: Props) {
  const [loading, setLoading] = useState<Record<ExportKey, boolean>>({
    users: false, posts: false, geo: false, utm: false, reports: false,
  });

  const setKey = (key: ExportKey, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));

  const handleExport = async (key: ExportKey) => {
    setKey(key, true);
    try {
      let ok = false;

      if (key === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, account_type, is_premium, city, country, created_at')
          .order('created_at', { ascending: false })
          .limit(10000);
        ok = downloadCSV(
          (data || []).map((u: any) => ({
            id:         u.id,
            name:       u.name       || '',
            email:      u.email      || '',
            type:       u.is_premium ? 'PRO' : 'Besplatan',
            city:       u.city       || '',
            country:    u.country    || '',
            registered: u.created_at?.slice(0, 10) || '',
          })),
          'korisnici',
        );

      } else if (key === 'posts') {
        const { data } = await supabase
          .from('posts')
          .select('id, text, post_type, status, views_count, created_at, author:profiles!user_id(name)')
          .order('created_at', { ascending: false })
          .limit(5000);
        ok = downloadCSV(
          (data || []).map((p: any) => {
            const author = Array.isArray(p.author) ? p.author[0] : p.author;
            return {
              id:      p.id,
              content: (p.text || '').slice(0, 200),
              type:    p.post_type   || '',
              status:  p.status      || '',
              views:   p.views_count || 0,
              author:  author?.name  || '',
              created: p.created_at?.slice(0, 10) || '',
            };
          }),
          'postovi',
        );

      } else if (key === 'geo') {
        const cities    = (analytics?.topCities    || []).map(c => ({ tip: 'grad',   ime: c.city,    korisnici: c.count }));
        const countries = (analytics?.topCountries || []).map(c => ({ tip: 'drzava', ime: c.country, korisnici: c.count }));
        ok = downloadCSV([...cities, ...countries], 'geografija');

      } else if (key === 'utm') {
        const rows = [
          ...(analytics?.utmSources                     || []).map(u => ({ kategorija: 'izvor',    ime: u.source,   broj: u.count })),
          ...(analytics?.marketingExtended.utmCampaigns || []).map(u => ({ kategorija: 'kampanja', ime: u.campaign, broj: u.count })),
          ...(analytics?.marketingExtended.utmMediums   || []).map(u => ({ kategorija: 'medij',    ime: u.medium,   broj: u.count })),
        ];
        ok = downloadCSV(rows, 'utm_podaci');

      } else if (key === 'reports') {
        const { data } = await supabase
          .from('reports')
          .select('id, target_type, reason, details, status, created_at, reporter:reporter_user_id(name), target_owner:target_owner_user_id(name)')
          .order('created_at', { ascending: false })
          .limit(5000);
        ok = downloadCSV(
          (data || []).map((r: any) => {
            const reporter    = Array.isArray(r.reporter)     ? r.reporter[0]     : r.reporter;
            const targetOwner = Array.isArray(r.target_owner) ? r.target_owner[0] : r.target_owner;
            return {
              id:        r.id,
              tip:       r.target_type || '',
              razlog:    r.reason      || '',
              detalji:   r.details     || '',
              status:    r.status      || '',
              prijavio:  reporter?.name      || '',
              prijavljen: targetOwner?.name  || '',
              datum:     r.created_at?.slice(0, 10) || '',
            };
          }),
          'reportovi',
        );
      }

      if (!ok) toast.info(EMPTY_MSG[key]);
    } catch (e) {
      console.error('Export greška:', e);
      toast.error('Greška pri exportu — pokušaj ponovo');
    } finally {
      setKey(key, false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-foreground">Export podataka (CSV)</h3>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Preuzmi podatke kao CSV fajl — kompatibilno sa Excel, Google Sheets i LibreOffice Calc.
        Srpska slova (č, ć, š, ž, đ) su podržana.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {EXPORTS.map(({ key, label, sublabel }) => (
          <button
            key={key}
            onClick={() => handleExport(key)}
            disabled={loading[key]}
            className="flex flex-col items-start gap-1.5 p-3 bg-muted hover:bg-accent rounded-xl text-left transition-colors disabled:opacity-60 group"
          >
            {loading[key] ? (
              <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
            ) : (
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
            )}
            <span className="text-xs font-semibold text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground leading-snug">{sublabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
