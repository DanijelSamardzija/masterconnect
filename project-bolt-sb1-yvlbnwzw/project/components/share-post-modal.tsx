'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Share2, X, Search, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { findOrCreateThread } from '@/lib/thread-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type SharePostModalProps = {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override the URL path, e.g. '/services/123'. Defaults to '/posts/postId' */
  urlPath?: string;
};

type UserResult = {
  id: string;
  name: string;
  avatar_url?: string;
  account_type: string;
};

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export function SharePostModal({ postId, open, onOpenChange, urlPath }: SharePostModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${urlPath ?? `/posts/${postId}`}`;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) setCanShare(true);
  }, []);

  useEffect(() => {
    if (!open) { setSearchQuery(''); setSearchResults([]); }
  }, [open]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, account_type')
        .ilike('name', `%${searchQuery}%`)
        .neq('id', user?.id ?? '')
        .limit(6);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, user?.id]);

  if (!open) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success(t('share.successToast'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('share.errorToast'));
    }
  };

  const handleWebShare = async () => {
    try {
      await navigator.share({ title: t('share.title'), url: postUrl });
    } catch (error: any) {
      if (error.name !== 'AbortError') toast.error(t('share.errorToast'));
    }
  };

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(postUrl)}`, '_blank');
  };

  const handleSendToUser = async (recipient: UserResult) => {
    if (!user) return;
    setSendingTo(recipient.id);
    try {
      const { threadId, error } = await findOrCreateThread({ customerId: user.id, proId: recipient.id });
      if (error || !threadId) throw new Error(error || 'No thread');
      const { error: msgError } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, text: postUrl });
      if (msgError) throw msgError;
      toast.success(t('share.sentToast'));
      onOpenChange(false);
    } catch {
      toast.error(t('share.sendError'));
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl">

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-foreground font-semibold text-base">{t('share.title')}</span>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Send to user */}
          {user && (
            <div className="px-5 mb-4">
              <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">{t('share.sendToUser')}</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('share.searchUsers')}
                  className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 bg-muted border border-border rounded-xl overflow-hidden">
                  {searchResults.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => handleSendToUser(u)}
                      disabled={!!sendingTo}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent transition-colors text-left ${i > 0 ? 'border-t border-border' : ''}`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-orange-600 text-white text-xs">
                          {u.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm text-foreground font-medium truncate">{u.name}</span>
                      {sendingTo === u.id
                        ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        : <Send className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mx-5 mb-4 border-t border-border" />

          {/* Link preview */}
          <div className="mx-5 mb-4 flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-3">
            <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{postUrl}</span>
            <button onClick={handleCopyLink} className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 px-5 pb-8">
            <button onClick={handleCopyLink} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-muted hover:bg-accent border border-border transition-colors text-foreground text-sm font-medium">
              {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
              <span>{copied ? t('share.copied') : t('share.copyLink')}</span>
            </button>

            <button onClick={handleWhatsAppShare} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors text-[#25D366] text-sm font-medium">
              <WhatsAppIcon />
              <span>{t('share.whatsapp')}</span>
            </button>

            {canShare && (
              <button onClick={handleWebShare} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-muted hover:bg-accent border border-border transition-colors text-foreground text-sm font-medium">
                <Share2 className="h-5 w-5 text-muted-foreground" />
                <span>{t('share.moreOptions')}</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
