'use client';

import { ChevronDown, ExternalLink, Filter, Loader2, Shield, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils/date';
import { toast } from 'sonner';
import Link from 'next/link';
import { Report, ReportFilter } from '../types';
import { REASON_LABELS, STATUS_COLORS, STATUS_LABEL } from '../constants';

interface Props {
  reports: Report[];
  loading: boolean;
  reportFilter: ReportFilter;
  reportTypeFilter: 'all' | 'post' | 'profile';
  hasMoreReports: boolean;
  loadingMoreReports: boolean;
  onFilterChange: (filter: ReportFilter) => void;
  onTypeFilterChange: (filter: 'all' | 'post' | 'profile') => void;
  onStatusChange: (reportId: string, status: string) => void;
  onDeletePost: (postId: string, reportId: string) => void;
  onLoadMore: () => void;
}

export function ReportsTab({
  reports,
  loading,
  reportFilter,
  reportTypeFilter,
  hasMoreReports,
  loadingMoreReports,
  onFilterChange,
  onTypeFilterChange,
  onStatusChange,
  onDeletePost,
  onLoadMore,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Filter by type */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {([
          { value: 'all', label: 'Svi tipovi' },
          { value: 'post', label: 'Objave' },
          { value: 'profile', label: 'Korisnici' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTypeFilterChange(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              reportTypeFilter === value
                ? 'bg-purple-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter by status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {(['all', 'open', 'reviewed', 'resolved'] as ReportFilter[]).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              reportFilter === f
                ? 'bg-orange-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'Svi' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        [...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Nema reportova</p>
          <p className="text-sm">Sve je čisto!</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reports
              .filter(r => reportTypeFilter === 'all' || r.target_type === reportTypeFilter)
              .map(report => (
                <div key={report.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Status + type + time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[report.status]}`}>
                          {STATUS_LABEL[report.status] || report.status}
                        </span>
                        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                          {report.target_type === 'post' ? 'Post' : report.target_type === 'profile' ? 'Profil' : report.target_type}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(report.created_at)}</span>
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Razlog: {REASON_LABELS[report.reason] || report.reason}
                        </p>
                        {report.details && (
                          <p className="text-sm text-muted-foreground mt-1 bg-muted rounded-xl px-3 py-2">
                            &quot;{report.details}&quot;
                          </p>
                        )}
                      </div>

                      {/* Reporter + reported */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Prijavio:</span>
                          <Link href={`/profile/${report.reporter.id}`} className="flex items-center gap-1.5 hover:underline">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={report.reporter.avatar_url} />
                              <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                                {report.reporter.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{report.reporter.name}</span>
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Prijavljeni:</span>
                          <Link href={`/profile/${report.target_owner.id}`} className="flex items-center gap-1.5 hover:underline">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={report.target_owner.avatar_url} />
                              <AvatarFallback className="text-[9px] bg-red-100 text-red-700">
                                {report.target_owner.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{report.target_owner.name}</span>
                          </Link>
                        </div>
                      </div>

                      {/* Post actions */}
                      {report.target_type === 'post' && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <Link
                            href={`/posts/${report.target_id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-500 font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Pogledaj post
                          </Link>
                          <button
                            onClick={() => onDeletePost(report.target_id, report.id)}
                            className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 font-medium"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Obriši post
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status select */}
                    <Select value={report.status} onValueChange={v => onStatusChange(report.id, v)}>
                      <SelectTrigger className="w-[130px] shrink-0 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Otvoren</SelectItem>
                        <SelectItem value="reviewed">Pregledano</SelectItem>
                        <SelectItem value="resolved">Riješeno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
          </div>

          {hasMoreReports && (
            <button
              onClick={onLoadMore}
              disabled={loadingMoreReports}
              className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
            >
              {loadingMoreReports
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
              }
            </button>
          )}
        </>
      )}
    </div>
  );
}
