'use client';

import { TwemojiText } from '@/components/twemoji';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

interface MessageReactionBarProps {
  onReactionSelect: (emoji: string) => void;
  className?: string;
}

export function MessageReactionBar({ onReactionSelect, className = '' }: MessageReactionBarProps) {
  return (
    <div
      className={`flex gap-1 bg-white border border-slate-200 rounded-full shadow-lg p-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReactionSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          title={`React with ${emoji}`}
        >
          <TwemojiText text={emoji} className="text-base" />
        </button>
      ))}
    </div>
  );
}
