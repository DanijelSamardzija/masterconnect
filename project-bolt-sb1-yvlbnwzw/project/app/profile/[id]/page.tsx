'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useGuestGate } from '@/lib/contexts/guest-gate-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import { ProtectedRoute } from '@/components/protected-route';
import { ProfileView } from '@/components/profile-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, MessageCircle, Star, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { ReviewModal } from '@/components/review-modal';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';

export const revalidate = 0;

type UserProfile = {
  id: string;
  name: string;
  email: string;
  account_type: string;
  city?: string | null;
  category?: string | null;
  bio?: string | null;
  skills?: unknown;
  phone?: string | null;
  show_phone?: boolean;
  avatar_url?: string | null;
  cover_url?: string | null;
  average_rating?: number | null;
  review_count?: number | null;
};

function UserProfileContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile: currentUserProfile } = useAuth();
  const { t } = useLanguage();
  const { openGuestGate } = useGuestGate();
  usePageTracking('profile_view');
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
    if (userId) {
      fetchProfile();
      if (user) {
        checkBlockStatus();
        if (!isOwnProfile) trackProfileView();
      }
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
      openGuestGate('message');
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
      openGuestGate('contact');
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
      .select('id, name, email, account_type, city, category, bio, skills, phone, avatar_url, average_rating, review_count, website_url, show_phone, show_email, is_premium, referral_code')
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

  const phoneDigits = profile.phone?.replace(/\D/g, '') ?? '';
  const callAction = profile.show_phone && profile.phone ? (
    user ? (
      <div className="flex gap-1.5 w-full">
        <a
          href={`tel:${profile.phone}`}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold h-8 shadow-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
        >
          <Phone className="h-4 w-4 shrink-0" />
          {t('profile.callUser')}
        </a>
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] transition-colors shrink-0"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
        <a
          href={`viber://chat?number=${phoneDigits}`}
          title="Viber"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors shrink-0"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z" />
          </svg>
        </a>
      </div>
    ) : (
      <button
        onClick={() => openGuestGate('phone')}
        className="inline-flex items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold h-8 w-full shadow-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
      >
        <Phone className="h-4 w-4 shrink-0" />
        {t('profile.callUser')}
      </button>
    )
  ) : undefined;

  const reviewAction = !isOwnProfile ? (
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
        profile={profile as typeof profile & { account_type: 'professional' | 'customer'; skills?: string[] }}
        currentUserId={user?.id}
        isOwnProfile={false}
        isLoggedIn={!!user}
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
  return <UserProfileContent />;
}
