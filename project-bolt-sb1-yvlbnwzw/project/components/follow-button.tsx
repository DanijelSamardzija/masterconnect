'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserPlus, UserCheck } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
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
  const { t } = useLanguage();

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
        toast.success(t('profile.unfollowed'));
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({ follower_id: currentUserId, following_id: targetUserId });

        if (error) throw error;
        toast.success(t('profile.followed'));
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
      className={`inline-flex items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 h-8 w-full shadow-sm ${
        isFollowing
          ? 'border border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950'
          : 'bg-orange-500 text-white hover:bg-orange-600'
      } ${className ?? ''}`}
    >
      {isFollowing ? (
        <><UserCheck className="h-4 w-4" />{t('profile.followingAction')}</>
      ) : (
        <><UserPlus className="h-4 w-4" />{t('profile.follow')}</>
      )}
    </button>
  );
}
