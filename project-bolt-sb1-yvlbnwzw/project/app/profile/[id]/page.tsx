'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import { ProtectedRoute } from '@/components/protected-route';
import { ProfileView } from '@/components/profile-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, MessageCircle, Star, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { ReviewModal } from '@/components/review-modal';

export const revalidate = 0;

type UserProfile = {
  id: string;
  name: string;
  email: string;
  account_type: 'professional' | 'customer';
  city?: string;
  category?: string;
  bio?: string;
  skills?: string[];
  phone?: string;
  show_phone?: boolean;
  avatar_url?: string;
  cover_url?: string;
  average_rating?: number;
  review_count?: number;
};

function UserProfileContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile: currentUserProfile } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const userId = params.id as string;
  const fromChat = searchParams.get('from') === 'chat';
  const threadId = searchParams.get('threadId');
  const isOwnProfile = user?.id === userId;

  const handleBack = () => {
    if (fromChat && threadId) {
      router.push(`/messages/${threadId}`);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (userId && user) {
      checkBlockStatus();
      fetchProfile();
      if (!isOwnProfile) trackProfileView();
    }
  }, [userId, user]);

  const trackProfileView = async () => {
    if (!user || isOwnProfile) return;
    await supabase.from('profile_views').insert({
      profile_id: userId,
      viewer_id: user.id,
    });
  };

  const checkBlockStatus = async () => {
    if (isOwnProfile || !user) return;

    const { data } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_user_id', user.id)
      .eq('blocked_user_id', userId)
      .maybeSingle();

    setIsBlocked(!!data);
  };

  const handleUnblock = async () => {
    setUnblocking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please sign in');
        setUnblocking(false);
        return;
      }

      const response = await fetch('/api/block', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          blockedUserId: userId
        })
      });

      if (response.ok) {
        toast.success(t('block.unblocked'));
        setIsBlocked(false);
      } else {
        toast.error(t('block.unblockFailed'));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error(t('block.unblockFailed'));
    } finally {
      setUnblocking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setSendingMessage(true);

    try {
      const { threadId, error } = await findOrCreateThread({
        customerId: userId,
        proId: user.id,
      });

      if (error) {
        toast.error('Failed to create conversation');
        console.error('Error creating thread:', error);
        return;
      }

      if (threadId) {
        router.push(`/messages/${threadId}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to create conversation');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLeaveReview = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      const { data: threadCheck } = await supabase
        .from('thread_participants')
        .select('thread_id')
        .eq('user_id', user.id);

      const { data: proThreadCheck } = await supabase
        .from('thread_participants')
        .select('thread_id')
        .eq('user_id', userId);

      const commonThreads = threadCheck?.filter((t1: any) =>
        proThreadCheck?.some((t2: any) => t2.thread_id === t1.thread_id)
      );

      if (!commonThreads || commonThreads.length === 0) {
        toast.error('You must have a conversation with this professional before leaving a review');
        return;
      }

      const threadIds = commonThreads.map((t: any) => t.thread_id);
      const { data: customerMessages } = await supabase
        .from('messages')
        .select('id')
        .in('thread_id', threadIds)
        .eq('sender_id', user.id)
        .eq('is_system', false)
        .limit(1);

      const { data: proMessages } = await supabase
        .from('messages')
        .select('id')
        .in('thread_id', threadIds)
        .eq('sender_id', userId)
        .eq('is_system', false)
        .limit(1);

      if (!customerMessages || customerMessages.length === 0 || !proMessages || proMessages.length === 0) {
        toast.error('You must exchange messages with this professional before leaving a review');
        return;
      }

      setReviewModalOpen(true);
    } catch (error: any) {
      console.error('Error checking review eligibility:', error);
      toast.error('Failed to check eligibility for review');
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, name, email, account_type, city, category, bio, skills, phone, avatar_url, average_rating, review_count, website_url, show_phone, show_email')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      setError('Failed to load profile');
    } else if (data) {
      setProfile(data);
    } else {
      setError('Profile not found');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-[#111827] py-8 pb-24">
        <div className="container mx-auto px-4 max-w-2xl">
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-slate-50 dark:bg-[#111827] min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Profile not found'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (isOwnProfile) {
    router.replace('/profile');
    return null;
  }

  if (isBlocked) {
    return (
      <div className="bg-slate-50 dark:bg-[#111827] min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('block.youBlockedThis')}
              <Button
                variant="link"
                onClick={handleUnblock}
                disabled={unblocking}
                className="p-0 h-auto ml-1"
              >
                {unblocking ? t('block.unblocking') : t('block.unblock')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const headerActions = (
    <Button
      onClick={handleSendMessage}
      disabled={sendingMessage}
      size="sm"
      className="w-full gap-1 rounded-full bg-orange-500 hover:bg-orange-600 text-white px-3 shadow-sm h-8 text-sm"
    >
      <MessageCircle className="h-4 w-4 shrink-0" />
      {sendingMessage ? '...' : t('profile.sendMessage')}
    </Button>
  );

  const callAction = profile.show_phone && profile.phone ? (
    <a
      href={`tel:${profile.phone}`}
      className="inline-flex items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold h-8 w-full shadow-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
    >
      <Phone className="h-4 w-4 shrink-0" />
      {t('profile.callUser')}
    </a>
  ) : undefined;

  const reviewAction = profile.account_type === 'professional' && !isOwnProfile ? (
    <Button
      onClick={handleLeaveReview}
      variant="outline"
      className="gap-2 rounded-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950 h-9 text-sm font-semibold px-5"
    >
      <Star className="h-4 w-4" />
      {t('profile.leaveReview')}
    </Button>
  ) : undefined;

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <ProfileView
        profile={profile}
        currentUserId={user?.id}
        isOwnProfile={false}
        onSendMessage={handleSendMessage}
        headerActions={headerActions}
        callAction={callAction}
        reviewAction={reviewAction}
      />

      {reviewModalOpen && (
        <ReviewModal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          proId={userId}
          proName={profile.name}
          onSuccess={() => {
            fetchProfile();
          }}
        />
      )}
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <ProtectedRoute>
      <UserProfileContent />
    </ProtectedRoute>
  );
}
