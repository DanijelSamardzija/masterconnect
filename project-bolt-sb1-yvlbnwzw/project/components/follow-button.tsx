'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  targetUserId: string;
  currentUserId: string;
  size?: 'sm' | 'default';
  className?: string;
  // When provided, component runs in controlled mode — no internal DB check
  isFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
};

export function FollowButton({ targetUserId, currentUserId, size = 'default', className, isFollowing: isFollowingProp, onFollowChange }: Props) {
  const isControlled = isFollowingProp !== undefined;

  const [localIsFollowing, setLocalIsFollowing] = useState(false);
  const [loading, setLoading] = useState(!isControlled);

  const isFollowing = isControlled ? isFollowingProp : localIsFollowing;

  useEffect(() => {
    if (!isControlled) {
      checkFollowStatus();
    }
  }, [targetUserId, currentUserId, isControlled]);

  const checkFollowStatus = async () => {
    try {
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

      setLocalIsFollowing(!!data);
    } catch (err) {
      console.error('FollowButton checkFollowStatus error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    const newValue = !isFollowing;

    // Optimistic update — UI changes immediately before server responds
    if (!isControlled) setLocalIsFollowing(newValue);
    onFollowChange?.(newValue);

    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

        if (error) throw error;
        toast.success('Unfollowed');
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({ follower_id: currentUserId, following_id: targetUserId });

        if (error) throw error;
        toast.success('Following');
      }
    } catch (err) {
      console.error('FollowButton toggle error:', err);
      // Revert optimistic update on failure
      if (!isControlled) setLocalIsFollowing(isFollowing);
      onFollowChange?.(isFollowing);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFollow}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 h-6 ${
        isFollowing
          ? 'border border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950'
          : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
      } ${className ?? ''}`}
    >
      {isFollowing ? (
        <><UserCheck className="h-3 w-3" />Following</>
      ) : (
        <><UserPlus className="h-3 w-3" />Follow</>
      )}
    </button>
  );
}
