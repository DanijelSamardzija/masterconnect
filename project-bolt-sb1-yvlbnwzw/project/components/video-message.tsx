'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause, AlertCircle, X, Maximize2 } from 'lucide-react';

// ─── Shared media dimensions ────────────────────────────────────────────────
export const MEDIA_MAX_WIDTH  = 280;
export const MEDIA_MAX_HEIGHT = 260;
export const MEDIA_RADIUS     = 'rounded-2xl';

// ─── Lightbox ───────────────────────────────────────────────────────────────
type LightboxProps = {
  onClose: () => void;
  children: React.ReactNode;
};

function Lightbox({ onClose, children }: LightboxProps) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Content — stop propagation so clicking media doesn't close */}
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Image message ───────────────────────────────────────────────────────────
type ImageMessageProps = {
  url: string;
  name: string;
};

export function ImageMessage({ url, name }: ImageMessageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`relative cursor-pointer overflow-hidden ${MEDIA_RADIUS} shadow-md`}
        style={{ maxWidth: MEDIA_MAX_WIDTH }}
        onClick={() => setOpen(true)}
      >
        <img
          src={url}
          alt={name}
          className={`block w-full object-cover transition-opacity hover:opacity-90 ${MEDIA_RADIUS}`}
          style={{ maxHeight: MEDIA_MAX_HEIGHT }}
        />
      </div>

      {open && (
        <Lightbox onClose={() => setOpen(false)}>
          <img
            src={url}
            alt={name}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
        </Lightbox>
      )}
    </>
  );
}

// ─── Video message ───────────────────────────────────────────────────────────
type VideoMessageProps = {
  url: string;
  mimeType?: string;
};

export function VideoMessage({ url, mimeType }: VideoMessageProps) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const manualPausedRef = useRef(false);

  const [muted,        setMuted]        = useState(true);
  const [playing,      setPlaying]      = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [showFlash,    setShowFlash]    = useState<'play' | 'pause' | null>(null);
  const [autoblocked,  setAutoblocked]  = useState(false);
  const [error,        setError]        = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Keep ref in sync
  useEffect(() => { manualPausedRef.current = manualPaused; }, [manualPaused]);

  // Sync playing state from native events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay  = () => { setPlaying(true);  setAutoblocked(false); };
    const onPause = () =>   setPlaying(false);
    const onEnded = () =>   setPlaying(false);
    v.addEventListener('play',  onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('play',  onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // IntersectionObserver — autoplay / autopause
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (manualPausedRef.current) return;
        v.play().catch(() => setAutoblocked(true));
      } else {
        v.pause();
        setManualPaused(false);
        manualPausedRef.current = false;
      }
    }, { threshold: 0.5 });

    observer.observe(v);
    return () => observer.disconnect();
  }, []);

  // Flash helper
  const flash = (type: 'play' | 'pause') => {
    setShowFlash(type);
    setTimeout(() => setShowFlash(null), 600);
  };

  // Click on preview video → play/pause
  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    if (!playing) {
      v.play().then(() => {
        setManualPaused(false);
        setAutoblocked(false);
        flash('play');
      }).catch(() => setAutoblocked(true));
    } else {
      v.pause();
      setManualPaused(true);
      flash('pause');
    }
  };

  // Mute toggle
  const handleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
  };

  // Fullscreen button
  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  if (error) {
    return (
      <div
        className={`flex items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-800 ${MEDIA_RADIUS}`}
        style={{ maxWidth: MEDIA_MAX_WIDTH }}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>Video nije dostupan</span>
      </div>
    );
  }

  return (
    <>
      {/* ── Preview bubble ── */}
      <div
        className={`relative overflow-hidden bg-black shadow-md ${MEDIA_RADIUS}`}
        style={{ maxWidth: MEDIA_MAX_WIDTH }}
      >
        <video
          ref={videoRef}
          src={url}
          muted
          loop
          playsInline
          preload="metadata"
          onClick={handleVideoClick}
          onError={() => setError(true)}
          className="block w-full cursor-pointer object-cover"
          style={{ maxHeight: MEDIA_MAX_HEIGHT }}
        >
          {mimeType && <source src={url} type={mimeType} />}
        </video>

        {/* Play/Pause flash */}
        {showFlash && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              {showFlash === 'pause'
                ? <Pause className="h-5 w-5 text-white" />
                : <Play  className="h-5 w-5 translate-x-0.5 text-white" />}
            </div>
          </div>
        )}

        {/* Persistent play overlay when stopped */}
        {!playing && !showFlash && (
          <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30"
            onClick={handleVideoClick}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <Play className="h-5 w-5 translate-x-0.5 text-gray-900" />
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {/* Mute */}
          <button
            onClick={handleMute}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Fullscreen lightbox ── */}
      {lightboxOpen && (
        <Lightbox onClose={() => setLightboxOpen(false)}>
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            style={{ background: 'black' }}
          >
            {mimeType && <source src={url} type={mimeType} />}
          </video>
        </Lightbox>
      )}
    </>
  );
}
