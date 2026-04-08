'use client';

import { useState } from 'react';
import { TwemojiText } from '@/components/twemoji';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Reaction = {
  id: string;
  emoji: string;
  user_id: string;
  user_name: string;
};

interface MessageReactionsDisplayProps {
  reactions: Reaction[];
  currentUserId?: string;
  onReactionClick: (emoji: string) => void;
}

export function MessageReactionsDisplay({
  reactions,
  currentUserId,
  onReactionClick
}: MessageReactionsDisplayProps) {
  if (reactions.length === 0) return null;

  const reactionCounts = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        count: 0,
        users: [],
        hasCurrentUser: false,
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.user_name);
    if (reaction.user_id === currentUserId) {
      acc[reaction.emoji].hasCurrentUser = true;
    }
    return acc;
  }, {} as Record<string, { count: number; users: string[]; hasCurrentUser: boolean }>);

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactionCounts).map(([emoji, data]) => (
        <Popover key={emoji}>
          <PopoverTrigger asChild>
            <button
              onClick={() => onReactionClick(emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                data.hasCurrentUser
                  ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <TwemojiText text={emoji} className="text-xs" />
              <span className="font-medium">{data.count}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 text-sm" side="top">
            <div className="font-medium mb-1">{emoji}</div>
            <div className="space-y-0.5">
              {data.users.map((userName, index) => (
                <div key={index} className="text-slate-600">
                  {userName}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
