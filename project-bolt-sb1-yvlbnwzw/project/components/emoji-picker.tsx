'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmileIcon, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TwemojiText } from '@/components/twemoji';

const EMOJI_CATEGORIES = {
  smileys: {
    label: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
      '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
    ]
  },
  gestures: {
    label: '👍',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
      '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆',
      '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙',
      '💪', '🦾', '🙏', '✍️', '👏', '👐', '🤲', '🤝',
    ]
  },
  hearts: {
    label: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗',
      '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️',
    ]
  },
  activities: {
    label: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
    ]
  },
  objects: {
    label: '💼',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️',
      '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷',
      '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟',
      '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏰',
    ]
  },
  symbols: {
    label: '🔣',
    emojis: [
      '❤️', '💯', '💢', '💬', '👁️‍🗨️', '💭', '💤', '💮',
      '♨️', '💈', '🛑', '🕛', '⏰', '⏱️', '⏲️', '🕰️',
      '💲', '✔️', '☑️', '✅', '❌', '❎', '➕', '➖',
      '➗', '✖️', '©️', '®️', '™️', '🔝', '🔙', '⬆️',
    ]
  },
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  recentEmojis?: string[];
  disabled?: boolean;
}

export function EmojiPicker({ onEmojiSelect, recentEmojis = [], disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState('recent');

  useEffect(() => {
    setDefaultTab(recentEmojis.length > 0 ? 'recent' : 'smileys');
  }, [recentEmojis]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="flex-shrink-0"
        >
          <SmileIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="top">
        <Tabs value={defaultTab} onValueChange={setDefaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-7 rounded-none border-b">
            <TabsTrigger value="recent" className="text-lg" title="Recent">
              <Clock className="h-4 w-4" />
            </TabsTrigger>
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="text-lg"
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="recent" className="m-0">
            <ScrollArea className="h-64">
              {recentEmojis.length > 0 ? (
                <div className="grid grid-cols-8 gap-1 p-2">
                  {recentEmojis.map((emoji, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="emoji-picker-button text-2xl hover:bg-slate-100 rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <TwemojiText text={emoji} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 px-4 text-center">
                  <Clock className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No recent emojis yet</p>
                  <p className="text-xs mt-1">Start using emojis to see them here</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
            <TabsContent key={key} value={key} className="m-0">
              <ScrollArea className="h-64">
                <div className="grid grid-cols-8 gap-1 p-2">
                  {category.emojis.map((emoji, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="emoji-picker-button text-2xl hover:bg-slate-100 rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <TwemojiText text={emoji} />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
