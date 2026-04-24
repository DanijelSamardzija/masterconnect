'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type FollowUser = {
  id: string;
  name: string;
  avatar_url?: string;
  account_type: string;
  city?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  type: 'followers' | 'following';
};

export function FollowListSheet({ open, onOpenChange, profileId, type }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, profileId, type]);

  const fetchUsers = async () => {
    setLoading(true);
    setUsers([]);

    let list: FollowUser[] = [];

    if (type === 'followers') {
      const { data } = await supabase
        .from('followers')
        .select('profiles!followers_follower_id_fkey(id, name, avatar_url, account_type, city)')
        .eq('following_id', profileId);
      list = (data || []).map((row: any) => row.profiles).filter(Boolean);
    } else {
      const { data } = await supabase
        .from('followers')
        .select('profiles!followers_following_id_fkey(id, name, avatar_url, account_type, city)')
        .eq('follower_id', profileId);
      list = (data || []).map((row: any) => row.profiles).filter(Boolean);
    }

    setUsers(list);

    // Proverimo koga trenutni korisnik vec prati
    if (user && list.length > 0) {
      const ids = list.map((u) => u.id);
      const { data: myFollows } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', ids);

      setFollowingSet(new Set((myFollows || []).map((r: any) => r.following_id)));
    }

    setLoading(false);
  };

  const handleToggleFollow = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (!user) return;

    setLoadingFollow(targetId);
    const isFollowing = followingSet.has(targetId);

    try {
      if (isFollowing) {
        await supabase.from('followers').delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetId);
        setFollowingSet((prev) => { const s = new Set(prev); s.delete(targetId); return s; });
        toast.success('Unfollowed');
      } else {
        await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId });
        setFollowingSet((prev) => new Set(prev).add(targetId));
        toast.success('Following');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleUserClick = (userId: string) => {
    onOpenChange(false);
    router.push(`/profile/${userId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle>{type === 'followers' ? 'Followers' : 'Following'}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] pb-4 pt-2 px-3">
          {loading ? (
            <div className="space-y-3 mt-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground mt-10 text-sm">
              {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          ) : (
            <div className="space-y-1 mt-2">
              {users.map((u) => {
                const isMe = user?.id === u.id;
                const isFollowing = followingSet.has(u.id);

                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleUserClick(u.id)}
                  >
                    <Avatar className="h-11 w-11 flex-shrink-0">
                      <AvatarImage src={u.avatar_url} alt={u.name} />
                      <AvatarFallback className="bg-orange-600 text-white font-semibold">
                        {u.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                      {u.city && (
                        <p className="text-xs text-muted-foreground truncate">{u.city}</p>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>

                      {!isMe && user && (
                        <Button
                          size="sm"
                          variant={isFollowing ? 'outline' : 'default'}
                          disabled={loadingFollow === u.id}
                          onClick={(e) => handleToggleFollow(e, u.id)}
                          className={
                            isFollowing
                              ? 'gap-1.5 border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 flex-shrink-0'
                              : 'gap-1.5 bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0'
                          }
                        >
                          {isFollowing ? (
                            <><UserCheck className="h-3.5 w-3.5" />Following</>
                          ) : (
                            <><UserPlus className="h-3.5 w-3.5" />Follow</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
