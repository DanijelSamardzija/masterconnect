'use client';

import { ChevronDown, ExternalLink, Filter, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { timeAgo } from '@/lib/utils/date';
import { SupportTicket } from '../types';
import { STATUS_COLORS } from '../constants';

interface Props {
  tickets: SupportTicket[];
  ticketFilter: 'all' | 'open' | 'in_progress' | 'resolved';
  expandedTicket: string | null;
  onFilterChange: (filter: 'all' | 'open' | 'in_progress' | 'resolved') => void;
  onExpandTicket: (id: string | null) => void;
  onStatusChange: (ticketId: string, status: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onRefresh: () => void;
}

export function SupportTab({
  tickets,
  ticketFilter,
  expandedTicket,
  onFilterChange,
  onExpandTicket,
  onStatusChange,
  onDeleteTicket,
  onRefresh,
}: Props) {
  const filtered = tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {([
          { value: 'all', label: 'Svi' },
          { value: 'open', label: 'Otvoreni' },
          { value: 'in_progress', label: 'U toku' },
          { value: 'resolved', label: 'Riješeno' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              ticketFilter === value
                ? 'bg-orange-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={onRefresh}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Osvježi
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nema tiketa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <div key={ticket.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => onExpandTicket(expandedTicket === ticket.id ? null : ticket.id)}
                className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      ticket.status === 'open' ? STATUS_COLORS.open
                      : ticket.status === 'in_progress' ? STATUS_COLORS.reviewed
                      : STATUS_COLORS.resolved
                    }`}>
                      {ticket.status === 'open' ? 'Otvoren'
                        : ticket.status === 'in_progress' ? 'U toku'
                        : 'Riješeno'}
                    </span>
                    {ticket.category && (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                        {ticket.category}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(ticket.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                  {ticket.profiles && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.profiles.name} · {ticket.profiles.email}
                    </p>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedTicket === ticket.id && (
                <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-xl px-4 py-3">
                    {ticket.message}
                  </p>
                  {ticket.attachment_url && (
                    <a
                      href={ticket.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-500 font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {ticket.attachment_name || 'Prilog'}
                    </a>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={ticket.status} onValueChange={v => onStatusChange(ticket.id, v)}>
                      <SelectTrigger className="w-[140px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Otvoren</SelectItem>
                        <SelectItem value="in_progress">U toku</SelectItem>
                        <SelectItem value="resolved">Riješeno</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => onDeleteTicket(ticket.id)}
                      className="p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
