'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Twemoji } from '@/components/twemoji';
import { cn } from '@/lib/utils';

type CommentReaction = {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type CommentReactionsProps = {
  commentId: string;
  postId: string;
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

export function CommentReactions({ commentId, postId }: CommentReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [optimisticReaction, setOptimisticReaction] = useState<string | null>(null);

  useEffect(() => {
    fetchReactions();

    const channel = supabase
      .channel(`comment-reactions-${commentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_reactions',
          filter: `comment_id=eq.${commentId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentId]);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('comment_reactions')
      .select('*')
      .eq('comment_id', commentId);

    if (data) {
      setReactions(data);
      const myReaction = data.find((r: any) => r.user_id === user?.id);
      setUserReaction(myReaction?.emoji || null);
      setOptimisticReaction(null);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    const currentReaction = optimisticReaction || userReaction;
    const isRemovingReaction = currentReaction === emoji;

    // Optimistic update
    if (isRemovingReaction) {
      setOptimisticReaction(null);
      setUserReaction(null);
    } else {
      setOptimisticReaction(emoji);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (isRemovingReaction) {
        // Delete the reaction
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) {
          // Revert optimistic update on error
          setOptimisticReaction(currentReaction);
          setUserReaction(currentReaction);
          console.error('Failed to remove reaction:', error);
        }
      } else {
        // Upsert the new reaction
        const { error } = await supabase
          .from('comment_reactions')
          .upsert({
            comment_id: commentId,
            user_id: user.id,
            emoji: emoji
          });

        if (error) {
          // Revert optimistic update on error
          setOptimisticReaction(null);
          console.error('Failed to add reaction:', error);
        }
      }
    } catch (error) {
      console.error('Error reacting to comment:', error);
      // Revert optimistic update
      setOptimisticReaction(null);
    }
  };

  const getEmojiCount = (emoji: string): number => {
    const displayReaction = optimisticReaction || userReaction;
    let count = reactions.filter((r) => r.emoji === emoji).length;

    if (displayReaction === emoji && !reactions.find((r) => r.user_id === user?.id && r.emoji === emoji)) {
      count++;
    } else if (userReaction === emoji && optimisticReaction !== emoji && reactions.find((r) => r.user_id === user?.id && r.emoji === emoji)) {
      count--;
    }

    return count;
  };

  const isUserReacting = (emoji: string): boolean => {
    const displayReaction = optimisticReaction || userReaction;
    return displayReaction === emoji;
  };

  const displayEmojis = Array.from(new Set([...QUICK_EMOJIS, ...reactions.map((r: any) => r.emoji)]));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayEmojis.map((emoji) => {
        const count = getEmojiCount(emoji);
        if (count === 0 && !QUICK_EMOJIS.includes(emoji)) return null;

        return (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            onClick={() => handleReaction(emoji)}
            className={cn(
              'h-7 px-2 gap-1 text-xs',
              isUserReacting(emoji) && 'bg-blue-100 hover:bg-blue-200 border border-blue-300'
            )}
          >
            <Twemoji className="w-4 h-4">{emoji}</Twemoji>
            {count > 0 && <span className="text-muted-foreground">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}
