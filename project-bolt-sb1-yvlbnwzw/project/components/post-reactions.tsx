'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Reaction = {
  id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type PostReactionsProps = {
  postId: string;
};

const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

export function PostReactions({ postId }: PostReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReactions();

    const channel = supabase
      .channel(`post_reactions:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_reactions',
          filter: `post_id=eq.${postId}`
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchReactions = async () => {
    const { data, error } = await supabase
      .from('post_reactions')
      .select('*')
      .eq('post_id', postId);

    if (!error && data) {
      setReactions(data);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const myReaction = data.find((r: any) => r.user_id === session.user.id);
        setUserReaction(myReaction?.emoji || null);
      }
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user || loading) return;

    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setLoading(false);
        return;
      }

      if (userReaction === emoji) {
        // Delete reaction using Supabase client
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (!error) {
          setUserReaction(null);
          setReactions(prev => prev.filter(r => r.user_id !== user.id));
        } else {
          console.error('Error deleting reaction:', error);
        }
      } else {
        // Upsert reaction using Supabase client
        const { data, error } = await supabase
          .from('post_reactions')
          .upsert({
            post_id: postId,
            user_id: user.id,
            emoji: emoji
          })
          .select()
          .single();

        if (!error && data) {
          setUserReaction(emoji);
          setReactions(prev => {
            const filtered = prev.filter(r => r.user_id !== user.id);
            return [...filtered, data];
          });
        } else {
          console.error('Error adding reaction:', error);
        }
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmojiCount = (emoji: string) => {
    return reactions.filter(r => r.emoji === emoji).length;
  };

  const totalReactions = reactions.length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {AVAILABLE_EMOJIS.map((emoji) => {
          const count = getEmojiCount(emoji);
          const isActive = userReaction === emoji;

          return (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              onClick={() => handleReaction(emoji)}
              disabled={loading}
              className={cn(
                'h-8 px-2 hover:bg-slate-100 transition-all',
                isActive && 'bg-blue-100 hover:bg-blue-200 ring-2 ring-blue-400'
              )}
            >
              <span className="text-base">{emoji}</span>
              {count > 0 && (
                <span className={cn(
                  'ml-1 text-xs font-medium',
                  isActive ? 'text-blue-700' : 'text-muted-foreground'
                )}>
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {totalReactions > 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
        </span>
      )}
    </div>
  );
}
