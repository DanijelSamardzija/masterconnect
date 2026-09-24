'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { resolvePreview, isGigZoneUrl } from '@/lib/link-preview';
import type { PreviewData } from '@/lib/link-preview';

interface LinkPreviewProps {
  url: string;
  /** True when the message belongs to the current user (changes colour scheme). */
  isOwn?: boolean;
}

export function LinkPreview({ url, isOwn = false }: LinkPreviewProps) {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null | 'pending'>('pending');

  useEffect(() => {
    let cancelled = false;
    resolvePreview(url).then((result) => { if (!cancelled) setData(result); });
    return () => { cancelled = true; };
  }, [url]);

  // While fetching or when no preview is available, render nothing — the URL stays as a plain link
  if (data === 'pending' || data === null) return null;

  const internal = isGigZoneUrl(url);

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

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent); }}
      className={`mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        isOwn
          ? 'border-white/20 bg-white/10 hover:bg-white/20'
          : 'border-border bg-card hover:bg-accent dark:bg-card'
      }`}
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
    </div>
  );
}
