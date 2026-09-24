'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Share2, X, Search, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { findOrCreateThread } from '@/lib/thread-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WhatsAppIcon, ViberIcon } from '@/components/brand-icons';

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


const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
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
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await (supabase as any).rpc('search_profiles', {
        p_search: searchQuery.trim(),
        p_limit: 6,
      });
      const results: UserResult[] = Array.isArray(data)
        ? (data as UserResult[]).filter((u) => u.id !== user?.id)
        : [];
      setSearchResults(results);
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

  const handleViberShare = () => {
    window.open(`viber://forward?text=${encodeURIComponent(postUrl)}`, '_blank');
  };

  const handleTelegramShare = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}`, '_blank');
  };

  const handleSendToUser = async (recipient: UserResult) => {
    if (!user) return;
    setSendingTo(recipient.id);
    try {
      const { threadId, error } = await findOrCreateThread({ customerId: user.id, proId: recipient.id });
      if (error || !threadId) throw new Error(error || 'No thread');
      const { error: msgError } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, receiver_id: recipient.id, text: postUrl });
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
                        <AvatarImage src={u.avatar_url} alt={u.name} />
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

            <button onClick={handleViberShare} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-[#7360F2]/10 hover:bg-[#7360F2]/20 border border-[#7360F2]/30 transition-colors text-[#7360F2] text-sm font-medium">
              <ViberIcon />
              <span>{t('share.viber')}</span>
            </button>

            <button onClick={handleTelegramShare} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-[#26A5E4]/10 hover:bg-[#26A5E4]/20 border border-[#26A5E4]/30 transition-colors text-[#26A5E4] text-sm font-medium">
              <TelegramIcon />
              <span>{t('share.telegram')}</span>
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
