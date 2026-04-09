'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

type OverlayData = {
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center' | 'right';
  fontSize: number;
};

type Props = {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  initialOverlay?: Partial<OverlayData> | null;
  onSave: (overlay: OverlayData | null) => void;
  onCancel: () => void;
};

const COLORS = [
  '#FFFFFF', '#000000', '#FACC15', '#EF4444',
  '#3B82F6', '#10B981', '#A855F7', '#EC4899',
  '#F97316', '#06B6D4', '#84CC16', '#F43F5E',
];

export function FlexibleTextOverlayEditor({
  mediaUrl,
  mediaType,
  initialOverlay,
  onSave,
  onCancel,
}: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [overlay, setOverlay] = useState<OverlayData>({
    text: initialOverlay?.text || '',
    color: initialOverlay?.color || '#FFFFFF',
    x: initialOverlay?.x ?? 50,
    y: initialOverlay?.y ?? 50,
    width: initialOverlay?.width ?? 75,
    align: initialOverlay?.align || 'center',
    fontSize: initialOverlay?.fontSize ?? 32,
  });

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Drag / tap to position ────────────────────────────────────────────────

  const applyPosition = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(90, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(15, Math.min(88, ((clientY - rect.top) / rect.height) * 100));
    setOverlay(prev => ({
      ...prev,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    }));
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only reposition on direct click (not drag-end)
    if (!isDragging) applyPosition(e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (isDragging) applyPosition(e.clientX, e.clientY); };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        e.preventDefault();
        applyPosition(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onEnd);
      };
    }
  }, [isDragging, applyPosition]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setPosition = (pos: 'top' | 'center' | 'bottom') => {
    setOverlay(prev => ({ ...prev, y: pos === 'top' ? 22 : pos === 'center' ? 50 : 80 }));
  };

  const handleSave = () => onSave(overlay.text.trim() ? overlay : null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-black"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Media preview (tap to reposition) ── */}
      <div className="relative flex flex-1 items-center justify-center bg-zinc-950 overflow-hidden">
        <div className="relative h-full w-full max-w-[430px]">
          {/* Media */}
          <div
            ref={containerRef}
            className="absolute inset-0 cursor-crosshair"
            onClick={handleContainerClick}
          >
            {mediaType === 'image' ? (
              <img src={mediaUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <video src={mediaUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
            )}

            {/* Subtle safe-zone guides */}
            <div className="pointer-events-none absolute inset-x-0 top-[15%] border-t border-dashed border-white/15" />
            <div className="pointer-events-none absolute inset-x-0 bottom-[15%] border-b border-dashed border-white/15" />

            {/* Draggable text overlay */}
            {overlay.text && (
              <div
                className={`absolute z-10 select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  width: `${overlay.width}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                {/* Drag handle ring */}
                <div className={`rounded-lg px-2 py-1 ring-2 ring-inset transition-all ${isDragging ? 'ring-orange-400/80' : 'ring-white/30'}`}>
                  <p
                    className="break-words whitespace-pre-wrap font-bold"
                    style={{
                      color: overlay.color,
                      fontSize: `${overlay.fontSize}px`,
                      textAlign: overlay.align,
                      lineHeight: 1.1,
                      textShadow: '0 2px 12px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {overlay.text}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tap hint */}
          {overlay.text && (
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/60 backdrop-blur-sm">
                {t('overlay.tapHint')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom controls panel ── */}
      <div
        className="bg-zinc-900 border-t border-white/10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        {/* Cancel | Colors | Save row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            onClick={onCancel}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide py-1 px-1">
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setOverlay(prev => ({ ...prev, color }))}
                className={`h-7 w-7 flex-shrink-0 rounded-full border-2 transition-all ${
                  overlay.color === color ? 'scale-125 border-white' : 'border-white/30'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <label className="relative flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-white/40 bg-gradient-to-br from-pink-500 via-yellow-400 to-blue-500">
              <input
                type="color"
                value={overlay.color}
                onChange={e => setOverlay(prev => ({ ...prev, color: e.target.value }))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>

          <button
            onClick={handleSave}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>

        {/* Text input row */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <input
            ref={inputRef}
            type="text"
            value={overlay.text}
            onChange={e => setOverlay(prev => ({ ...prev, text: e.target.value }))}
            placeholder={t('overlay.enterText')}
            maxLength={120}
            className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-orange-400/60 focus:bg-white/15"
          />
          {overlay.text && (
            <button
              onClick={() => setOverlay(prev => ({ ...prev, text: '' }))}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-red-500/20 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {overlay.text && (
          <div className="space-y-3 px-3 pb-2">
            {/* Row: Position + Alignment */}
            <div className="flex items-center gap-2">
              {/* Position shortcuts */}
              <div className="flex flex-1 gap-1.5">
                {(['top', 'center', 'bottom'] as const).map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosition(pos)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                      (pos === 'top' && overlay.y < 30) ||
                      (pos === 'center' && overlay.y >= 30 && overlay.y <= 70) ||
                      (pos === 'bottom' && overlay.y > 70)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/15'
                    }`}
                  >
                    {t(`overlay.${pos}`)}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-white/15" />

              {/* Alignment */}
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align, i) => {
                  const icons = [AlignLeft, AlignCenter, AlignRight];
                  const Icon = icons[i];
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setOverlay(prev => ({ ...prev, align }))}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                        overlay.align === align
                          ? 'bg-orange-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/15'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row: Font size slider */}
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-xs font-bold text-white/50" style={{ fontSize: 11 }}>A</span>
              <Slider
                value={[overlay.fontSize]}
                onValueChange={([v]) => setOverlay(prev => ({ ...prev, fontSize: v }))}
                min={14}
                max={72}
                step={2}
                className="flex-1"
              />
              <span className="w-8 text-center text-base font-bold text-white/50">A</span>
            </div>

            {/* Row: Width slider */}
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-[10px] text-white/40">{t('overlay.width')}</span>
              <Slider
                value={[overlay.width]}
                onValueChange={([v]) => setOverlay(prev => ({ ...prev, width: v }))}
                min={30}
                max={95}
                step={5}
                className="flex-1"
              />
              <span className="w-8 text-right text-[10px] text-white/40">{overlay.width}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
