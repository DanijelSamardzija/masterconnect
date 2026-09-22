'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { X, Send, Loader2, MessageSquare, ExternalLink } from 'lucide-react';
import { uploadFile } from '@/lib/attachment-utils';
import { findOrCreateThread } from '@/lib/thread-utils';
import { toCsv } from '@/lib/utils/export-utils';

// ── Types ──────────────────────────────────────────────────────────────────

type DocType = 'table' | 'note' | 'list';
type SchemaCol = { id: string; name: string; type: string; required: boolean };
type TableRow = Record<string, string | number | boolean | null>;
type NoteRow  = { content: string };
type ListRow  = { text: string; checked: boolean };

type Doc = {
  id:          string;
  business_id: string;
  doc_type:    DocType;
  title:       string;
  schema:      SchemaCol[];
  rows:        TableRow[] | NoteRow[] | ListRow[];
};

type LinkedClient = {
  id:               string;
  name:             string;
  linked_user_id:   string;
  linked_user_name: string;
};

type Props = {
  doc:            Doc;
  profileId:      string;
  open:           boolean;
  onOpenChange:   (v: boolean) => void;
};

// ── File generation ────────────────────────────────────────────────────────

function generateFileContent(doc: Doc): { content: string; filename: string; mimeType: string } {
  const date = new Date().toISOString().slice(0, 10);

  if (doc.doc_type === 'table') {
    const rows = doc.rows as TableRow[];
    const content = toCsv(
      doc.schema.map(c => c.name),
      rows.map(row => doc.schema.map(c => {
        const v = row[c.id];
        return v === null || v === undefined ? '' : String(v);
      })),
    );
    return { content, filename: `${doc.title}-${date}.csv`, mimeType: 'text/csv' };
  }

  if (doc.doc_type === 'note') {
    const rows = doc.rows as NoteRow[];
    const content = `${doc.title}\n${'─'.repeat(40)}\n\n${rows[0]?.content ?? ''}`;
    return { content, filename: `${doc.title}-${date}.txt`, mimeType: 'text/plain' };
  }

  // list
  const rows = doc.rows as ListRow[];
  const lines = [
    doc.title,
    '─'.repeat(40),
    '',
    ...rows.map(r => `${r.checked ? '[x]' : '[ ]'} ${r.text}`),
  ];
  return { content: lines.join('\n'), filename: `${doc.title}-${date}.txt`, mimeType: 'text/plain' };
}

// ── Component ──────────────────────────────────────────────────────────────

export function SendDocModal({ doc, profileId: _profileId, open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  const [clients, setClients]               = useState<LinkedClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<LinkedClient | null>(null);
  const [message, setMessage]               = useState('');
  const [loading, setLoading]               = useState(false);
  const [sending, setSending]               = useState(false);
  const [sentThreadId, setSentThreadId]     = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSentThreadId(null);
      setSelectedClient(null);
      setMessage('');
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadClients() {
    setLoading(true);
    const { data } = await (supabase as any).rpc('list_linked_trade_clients', {
      p_business_id: doc.business_id,
    });
    if (data?.ok) {
      const list: LinkedClient[] = data.clients ?? [];
      setClients(list);
      if (list.length === 1) setSelectedClient(list[0]);
    }
    setLoading(false);
  }

  async function handleSend() {
    if (!selectedClient || !user) return;
    setSending(true);
    try {
      // 1. Generate file snapshot (CSV or TXT) — never touches trade_custom_docs directly
      const { content, filename, mimeType } = generateFileContent(doc);
      const file = new File([content], filename, { type: mimeType });

      // 2. Upload to message-attachments bucket
      const uploaded = await uploadFile(file, user.id);
      if (!uploaded) throw new Error('upload_failed');

      // 3. Find or create direct GigZone chat thread
      const { threadId, error: threadErr } = await findOrCreateThread({
        customerId: user.id,
        proId:      selectedClient.linked_user_id,
      });
      if (!threadId) throw new Error(threadErr ?? 'thread_failed');

      // 4. Insert the message
      const text = message.trim() || doc.title;
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .insert({
          thread_id:   threadId,
          sender_id:   user.id,
          receiver_id: selectedClient.linked_user_id,
          text,
        })
        .select('id')
        .single();

      if (msgErr || !msgData) throw new Error(msgErr?.message ?? 'message_failed');

      // 5. Insert attachment record
      await supabase.from('message_attachments').insert({
        message_id:  msgData.id,
        file_url:    uploaded.url,
        file_path:   uploaded.path,
        file_name:   filename,
        file_type:   mimeType,
        file_size:   file.size,
        uploaded_by: user.id,
      });

      setSentThreadId(threadId);
      toast.success(t('trade.send.success'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const key = msg === 'upload_failed' ? 'trade.send.uploadFailed'
                : msg === 'thread_failed'  ? 'trade.send.threadFailed'
                : 'common.error.generic';
      toast.error(t(key as Parameters<typeof t>[0]));
    }
    setSending(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{t('trade.send.title')}</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">

          {/* Document badge */}
          <div className="p-3 rounded-xl bg-muted flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate flex-1">{doc.title}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary uppercase shrink-0">
              {doc.doc_type === 'table' ? 'CSV' : 'TXT'}
            </span>
          </div>

          {/* Post-send state */}
          {sentThreadId ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-semibold text-foreground text-center">
                {t('trade.send.success')}
              </p>
              <button
                onClick={() => {
                  router.push(`/messages/${sentThreadId}`);
                  onOpenChange(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t('trade.send.viewChat')}
              </button>
            </div>
          ) : (
            <>
              {/* Client list */}
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 px-2">
                  {t('trade.send.noLinkedClients')}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {t('trade.send.selectClient')}
                  </p>
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedClient?.id === c.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-accent'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.linked_user_name}</p>
                      </div>
                      {selectedClient?.id === c.id && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Message input */}
              {clients.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('trade.send.messageLabel')}
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={t('trade.send.messagePh')}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}

              {/* Send button */}
              {clients.length > 0 && (
                <button
                  onClick={handleSend}
                  disabled={!selectedClient || sending}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                  {sending ? t('trade.send.sending') : t('trade.send.send')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
