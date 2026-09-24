'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { resolvePreview, isGigZoneUrl } from '@/lib/link-preview';
import type { PreviewData } from '@/lib/link-preview';
import { useLanguage } from '@/lib/contexts/language-context';

interface LinkPreviewProps {
  url: string;
  /** True when the message belongs to the current user (changes colour scheme). */
  isOwn?: boolean;
}

export function LinkPreview({ url, isOwn = false }: LinkPreviewProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState<PreviewData | null | 'pending'>('pending');
  const internal = isGigZoneUrl(url);

  useEffect(() => {
    let cancelled = false;
    resolvePreview(url).then((result) => { if (!cancelled) setData(result); });
    return () => { cancelled = true; };
  }, [url]);

  // Still loading
  if (data === 'pending') return null;

  // External URL with no preview → render nothing (plain URL shown in message text)
  if (data === null && !internal) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (internal) {
      const u = new URL(url);
      router.push(u.pathname + u.search);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent);
  };

  const cardClass = `mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
    isOwn
      ? 'border-white/20 bg-white/10 hover:bg-white/20'
      : 'border-border bg-card hover:bg-accent dark:bg-card'
  }`;

  // GigZone URL where preview resolution returned null — show minimal fallback card
  if (data === null) {
    return (
      <div role="link" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown} className={cardClass}>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${isOwn ? 'bg-white/15' : 'bg-muted'}`}>
          <ExternalLink className={`h-5 w-5 ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold leading-snug ${isOwn ? 'text-white' : 'text-foreground'}`}>
            gigzone.app
          </p>
          <p className={`mt-0.5 truncate text-xs leading-snug ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
            {url}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${isOwn ? 'text-white/80' : 'text-primary'}`}>
          {t('messages.openLink')} →
        </span>
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cardClass}
    >
      {/* Thumbnail */}
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${isOwn ? 'bg-white/15' : 'bg-muted'}`}>
          <ExternalLink className={`h-5 w-5 ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`} />
        </div>
      )}

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold leading-snug ${isOwn ? 'text-white' : 'text-foreground'}`}>
          {data.title}
        </p>
        {data.description && (
          <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
            {data.description}
          </p>
        )}
        <p className={`mt-1 text-[10px] font-medium uppercase tracking-wide ${isOwn ? 'text-white/45' : 'text-muted-foreground/60'}`}>
          {data.domain}
        </p>
      </div>

      {/* Open button */}
      <span className={`shrink-0 text-sm font-semibold ${isOwn ? 'text-white/80' : 'text-primary'}`}>
        {t('messages.openLink')} →
      </span>
    </div>
  );
}
