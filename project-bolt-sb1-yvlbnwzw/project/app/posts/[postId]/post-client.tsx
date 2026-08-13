'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { ReportModal } from '@/components/report-modal';
import { CommentsSheet } from '@/components/comments-sheet';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Pin, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, DollarSign, Briefcase, Heart, Send, Pencil, Share2 } from 'lucide-react';
import { ContactCard } from '@/components/contact-card';
import { timeAgo } from '@/lib/utils/date';
import { toast } from 'sonner';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { OfferServiceModal } from '@/components/offer-service-modal';
import { EditPostModal } from '@/components/edit-post-modal';
import { JobApplicationModal } from '@/components/job-application-modal';
import { useLanguage } from '@/lib/contexts/language-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { isValidCategory, getCategoryLabel, type CategorySlug } from '@/lib/seo/categories';
import { slugifyCity } from '@/lib/seo/slugify';
import { trackView } from '@/lib/recently-viewed';

const JOB_POST_TYPES = ['hiring_post', 'job_seeker_post', 'service_request'] as const;

type PostMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  overlay_text?: string | null;
  overlay_color?: string | null;
  overlay_x?: number | null;
  overlay_y?: number | null;
  overlay_width?: number | null;
  overlay_align?: 'left' | 'center' | 'right' | null;
  overlay_font_size?: number | null;
};

type PostUser = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  account_type: 'professional' | 'customer';
  average_rating?: number;
  review_count?: number;
  phone?: string | null;
  show_phone?: boolean;
};

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  job_title: string | null;
  created_at: string;
  is_pinned: boolean;
  pinned_at: string | null;
  post_type: string;
  city: string | null;
  country: string | null;
  category: string | null;
  experience_level: string | null;
  availability: string | null;
  user: PostUser;
  media: PostMedia[];
  reactions_count: number;
  comments_count: number;
  user_has_reacted: boolean;
};

export type PostInitialData = Omit<Post, 'media' | 'reactions_count' | 'comments_count' | 'user_has_reacted'>;

export type RelatedPost = {
  id: string;
  job_title: string | null;
  text: string | null;
  post_type: string;
  city: string | null;
  category: string | null;
  created_at: string;
  author_name: string;
};

function getExperienceLabel(value: string | null, t: (k: string) => string): string | null {
  if (value === 'Entry') return t('marketplace.expEntry');
  if (value === 'Mid') return t('marketplace.expMid');
  if (value === 'Senior') return t('marketplace.expSenior');
  if (value === 'Expert') return t('marketplace.expExpert');
  return null;
}

function getAvailabilityLabel(value: string | null, t: (k: string) => string): string | null {
  if (value === 'Immediately') return t('marketplace.availImmediately');
  if (value === 'Within 1 week') return t('marketplace.avail1Week');
  if (value === 'Within 2 weeks') return t('marketplace.avail2Weeks');
  return null;
}


function SinglePostContent({ initialData, relatedPosts }: { initialData: PostInitialData; relatedPosts: RelatedPost[] }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  usePageTracking('post');
  const postId = params.postId as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerServiceModalOpen, setOfferServiceModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'post' | 'comment' | 'profile'>('post');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportTargetUserId, setReportTargetUserId] = useState('');
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [selectedHiringPost, setSelectedHiringPost] = useState<{ id: string; title: string; ownerId: string } | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    fetchInteractiveData();
    const title = initialData.job_title || initialData.text?.slice(0, 60) || 'Post';
    trackView({ id: postId, title, url: `/posts/${postId}` });
  }, [postId]);

  useEffect(() => {
    if (!post) return;
    if (post.post_type === 'social_post' && !post.text && post.media.length === 0) {
      router.replace('/feed');
      return;
    }
    if (post.post_type === 'social_post' && post.media.length > 0) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [post]);

  const fetchInteractiveData = async () => {
    try {
      const [mediaResult, reactionsResult, commentsResult, userReactionResult] = await Promise.all([
        supabase
          .from('post_media')
          .select('*')
          .eq('post_id', postId)
          .order('order', { ascending: true }),

        supabase
          .from('post_reactions')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId),

        supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId),

        user ? supabase
          .from('post_reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setPost({
        ...initialData,
        media: (mediaResult.data ?? []) as unknown as PostMedia[],
        reactions_count: reactionsResult.count ?? 0,
        comments_count: commentsResult.count ?? 0,
        user_has_reacted: !!userReactionResult.data,
      });

      supabase.rpc('increment_post_views', { post_id: postId });
    } catch (err: any) {
      console.error('[PostDetail] Error fetching interactive data:', err);
      // Degrade gracefully — show post from initialData without interactive counts
      setPost({
        ...initialData,
        media: [],
        reactions_count: 0,
        comments_count: 0,
        user_has_reacted: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContactAuthor = async () => {
    if (!user || !post) return;

    if (post.user_id === user.id) {
      toast.error('Ne možete kontaktirati svoj post');
      return;
    }

    setContactLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/messages/create-direct-thread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: post.user_id }),
      });

      const data = await response.json();
      if (response.ok && data.threadId) {
        router.push(`/messages/${data.threadId}`);
      } else {
        toast.error(data.error || 'Greška pri kreiranju razgovora');
      }
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      toast.error('Greška pri kreiranju razgovora');
    } finally {
      setContactLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user || !post || likeLoading) return;
    setLikeLoading(true);
    const isLiked = post.user_has_reacted;
    setPost(p => p ? { ...p, user_has_reacted: !isLiked, reactions_count: isLiked ? p.reactions_count - 1 : p.reactions_count + 1 } : p);
    try {
      if (isLiked) {
        await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('post_reactions').upsert({ post_id: post.id, user_id: user.id, reaction_type: 'like', emoji: '❤️' }, { onConflict: 'post_id,user_id' });
      }
    } catch {
      setPost(p => p ? { ...p, user_has_reacted: isLiked, reactions_count: post.reactions_count } : p);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `https://www.gigzone.app/posts/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.job_title || 'GigZone oglas', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t('share.successToast'));
      }
    } catch {
      // User cancelled share or clipboard unavailable
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!post) return;
    try {
      const { error: delError } = await supabase.from('posts').delete().eq('id', post.id);
      if (delError) throw delError;
      toast.success(t('posts.deleteSuccess'));
      router.push('/feed');
    } catch (err) {
      console.error('Error deleting post:', err);
      toast.error(t('posts.deleteError'));
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/feed');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button variant="ghost" onClick={() => handleBack()} className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || t('jobs.postNotFound')}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // ── Social post media viewer (separate layout) ──────────────────────────────
  if (post.post_type === 'social_post' && post.media.length > 0) {
    const currentMedia = post.media[currentMediaIndex];
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button onClick={() => handleBack()} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link href={`/profile/${post.user_id}`} prefetch={false} className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-orange-500 text-white text-xs">
                  {post.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold text-sm truncate hover:text-orange-500 transition-colors">{post.user.name}</p>
            </Link>
          </div>

          <div
            className="relative bg-black"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchMove={(e) => { touchEndX.current = e.touches[0].clientX; }}
            onTouchEnd={() => {
              if (touchStartX.current === null || touchEndX.current === null) return;
              const diff = touchStartX.current - touchEndX.current;
              if (Math.abs(diff) > 50) {
                if (diff > 0 && currentMediaIndex < post.media.length - 1) setCurrentMediaIndex(p => p + 1);
                else if (diff < 0 && currentMediaIndex > 0) setCurrentMediaIndex(p => p - 1);
              }
              touchStartX.current = null;
              touchEndX.current = null;
            }}
          >
            {currentMedia.type === 'video' ? (
              <video src={currentMedia.url} controls playsInline className="w-full max-h-[80vh] object-contain" />
            ) : (
              <Image
                src={currentMedia.url}
                alt={post.job_title || (post.text || '').slice(0, 80) || 'GigZone post'}
                width={1080}
                height={1350}
                style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain' }}
                sizes="(max-width: 1024px) 100vw, 512px"
                priority
              />
            )}

            {post.media.length > 1 && (
              <>
                {currentMediaIndex > 0 && (
                  <button onClick={() => setCurrentMediaIndex(p => p - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 z-10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {currentMediaIndex < post.media.length - 1 && (
                  <button onClick={() => setCurrentMediaIndex(p => p + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 z-10">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full z-10">
                  {currentMediaIndex + 1} / {post.media.length}
                </div>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                  {post.media.map((_, i) => (
                    <button key={i} onClick={() => setCurrentMediaIndex(i)} className={`h-1.5 rounded-full transition-all ${i === currentMediaIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <button onClick={handleLike} disabled={!user} className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                <Heart className={`h-4 w-4 ${post.user_has_reacted ? 'fill-red-500 text-red-500' : ''}`} />
                {post.reactions_count}
              </button>
              <button onClick={() => setCommentsModalOpen(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <MessageSquare className="h-4 w-4" />
                {post.comments_count}
              </button>
            </div>
            {post.text && <p className="text-sm text-foreground whitespace-pre-wrap">{post.text}</p>}
          </div>
        </div>

        <CommentsSheet open={commentsModalOpen} onOpenChange={setCommentsModalOpen} postId={post.id} commentsCount={post.comments_count || 0} onCommentAdded={fetchInteractiveData} />
        <ReportModal open={reportModalOpen} onOpenChange={setReportModalOpen} targetType={reportType} targetId={reportTargetId} targetOwnerUserId={reportTargetUserId} />
        <EditPostModal open={editModalOpen} onOpenChange={setEditModalOpen} postId={post.id} postType={post.post_type as any} initialText={post.text} media={post.media} onSave={async () => { await fetchInteractiveData(); }} />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('posts.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('posts.deleteConfirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('posts.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">{t('posts.confirmDelete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Job / regular post view ──────────────────────────────────────────────────
  const isJobPost = JOB_POST_TYPES.includes(post.post_type as any);
  const isOwner = !!user && post.user_id === user.id;

  // Info chips data
  const isPortfolioPost = post.post_type === 'portfolio_post';
  const chipSection = isPortfolioPost ? 'services' : 'jobs';
  const chips: { key: string; label: string; href: string | null }[] = [];
  if (post.category && isValidCategory(post.category)) {
    chips.push({
      key: 'category',
      label: getCategoryLabel(post.category as CategorySlug, language as any),
      href: `/${language}/${chipSection}/${post.category}`,
    });
  }
  if (post.city) {
    const citySlug = slugifyCity(post.city);
    const cityHref = citySlug && post.category && isValidCategory(post.category)
      ? `/${language}/${chipSection}/${post.category}/${citySlug}`
      : null;
    chips.push({ key: 'city', label: post.city, href: cityHref });
  }
  if (post.country) {
    chips.push({ key: 'country', label: post.country, href: null });
  }
  const expLabel = getExperienceLabel(post.experience_level, t);
  if (expLabel) {
    chips.push({ key: 'experience', label: `${t('jobs.experience')}: ${expLabel}`, href: null });
  }
  const availLabel = getAvailabilityLabel(post.availability, t);
  if (availLabel) {
    chips.push({ key: 'availability', label: `${t('jobs.availability')}: ${availLabel}`, href: null });
  }

  return (
    <div className="bg-background py-8 pb-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button variant="ghost" onClick={() => handleBack()} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        {/* HTML breadcrumb — job post types */}
        {isJobPost && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <li>
                <Link href="/" className="hover:text-orange-500 transition-colors">GigZone</Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link href={`/${language}/jobs`} className="hover:text-orange-500 transition-colors">
                  {t('nav.jobs')}
                </Link>
              </li>
              {post.category && isValidCategory(post.category) && (
                <>
                  <li aria-hidden="true">›</li>
                  <li>
                    <Link
                      href={`/${language}/jobs/${post.category}`}
                      className="hover:text-orange-500 transition-colors"
                    >
                      {getCategoryLabel(post.category as CategorySlug, language as any)}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                {post.job_title || (post.text || '').slice(0, 40) || t('common.listing')}
              </li>
            </ol>
          </nav>
        )}

        {/* HTML breadcrumb — portfolio post: GigZone > Usluge > [category] > [title] */}
        {isPortfolioPost && post.category && isValidCategory(post.category) && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <li>
                <Link href="/" className="hover:text-orange-500 transition-colors">GigZone</Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link href={`/${language}/services`} className="hover:text-orange-500 transition-colors">
                  {t('nav.discover')}
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link
                  href={`/${language}/services/${post.category}`}
                  className="hover:text-orange-500 transition-colors"
                >
                  {getCategoryLabel(post.category as CategorySlug, language as any)}
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                {post.job_title || (post.text || '').slice(0, 40) || t('common.listing')}
              </li>
            </ol>
          </nav>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Link href={`/profile/${post.user_id}`} prefetch={false}>
                <Avatar className="h-10 w-10 hover:opacity-80 transition-opacity">
                  <AvatarFallback className="bg-blue-600 text-white">
                    {post.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${post.user_id}`} prefetch={false} className="font-semibold hover:text-orange-500 transition-colors">
                        {post.user.name}
                      </Link>
                      {post.is_pinned && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{timeAgo(post.created_at)}</p>
                  </div>

                  {/* Owner CTAs */}
                  {isOwner && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
                        <Share2 className="h-3.5 w-3.5" />
                        {t('share.copyLink')}
                      </Button>
                    </div>
                  )}

                  {/* Non-owner CTAs */}
                  {user && !isOwner && (
                    <div className="flex gap-2 flex-wrap">
                      {post.post_type === 'hiring_post' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedHiringPost({ id: post.id, title: post.job_title || post.text?.substring(0, 60) || 'oglas', ownerId: post.user_id });
                            setApplicationModalOpen(true);
                          }}
                          className="gap-1.5 bg-orange-600 hover:bg-orange-700"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {t('jobs.applyButton')}
                        </Button>
                      )}
                      {post.post_type === 'job_seeker_post' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOfferModalOpen(true);
                          }}
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          {t('jobs.offerJobButton')}
                        </Button>
                      )}
                      {post.post_type === 'service_request' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOfferServiceModalOpen(true);
                          }}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                          {t('jobs.offerServiceButton')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleContactAuthor}
                        disabled={contactLoading}
                        className="gap-1.5 bg-orange-600 hover:bg-orange-700"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {contactLoading ? t('common.loading') : t('jobs.sendMessageButton')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Job title + info chips — job post types and portfolio */}
          {(isJobPost || isPortfolioPost) && (post.job_title || chips.length > 0) && (
            <CardContent className="pt-0 pb-3">
              {post.job_title && (
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  {post.job_title}
                </h1>
              )}
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map(chip =>
                    chip.href ? (
                      <Link
                        key={chip.key}
                        href={chip.href}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400 transition-colors font-medium"
                      >
                        {chip.label}
                      </Link>
                    ) : (
                      <span
                        key={chip.key}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      >
                        {chip.label}
                      </span>
                    )
                  )}
                </div>
              )}
            </CardContent>
          )}

          {post.text && (
            <CardContent className={isJobPost && (post.job_title || chips.length > 0) ? 'pt-0' : undefined}>
              <p className="whitespace-pre-wrap leading-relaxed">{post.text}</p>
            </CardContent>
          )}

          {post.media.length > 0 && (
            <CardContent className="pt-0">
              <div className="relative rounded-lg overflow-hidden bg-slate-100">
                {post.media.length === 1 ? (
                  <div className="relative">
                    {post.media[0].type === 'image' ? (
                      <Image
                        src={post.media[0].url}
                        alt={post.job_title || (post.text || '').slice(0, 80) || 'GigZone post'}
                        width={1200}
                        height={900}
                        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                        sizes="(max-width: 768px) calc(100vw - 32px), 720px"
                        priority
                      />
                    ) : (
                      <video src={post.media[0].url} controls className="w-full h-auto" />
                    )}
                  </div>
                ) : (
                  <div
                    className="relative"
                    onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchMove={(e) => { touchEndX.current = e.touches[0].clientX; }}
                    onTouchEnd={() => {
                      if (touchStartX.current === null || touchEndX.current === null) return;
                      const diff = touchStartX.current - touchEndX.current;
                      if (Math.abs(diff) > 50) {
                        if (diff > 0 && currentMediaIndex < post.media.length - 1) setCurrentMediaIndex(prev => prev + 1);
                        else if (diff < 0 && currentMediaIndex > 0) setCurrentMediaIndex(prev => prev - 1);
                      }
                      touchStartX.current = null;
                      touchEndX.current = null;
                    }}
                  >
                    {post.media[currentMediaIndex].type === 'image' ? (
                      <Image
                        src={post.media[currentMediaIndex].url}
                        alt={post.job_title || (post.text || '').slice(0, 80) || 'GigZone post'}
                        width={1200}
                        height={900}
                        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                        sizes="(max-width: 768px) calc(100vw - 32px), 720px"
                        priority={currentMediaIndex === 0}
                      />
                    ) : (
                      <video src={post.media[currentMediaIndex].url} controls className="w-full h-auto" />
                    )}

                    {currentMediaIndex > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMediaIndex(prev => prev - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    )}
                    {currentMediaIndex < post.media.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMediaIndex(prev => prev + 1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    )}

                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {post.media.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentMediaIndex(index)}
                          className={`h-2 rounded-full transition-all ${index === currentMediaIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>

                    <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                      {currentMediaIndex + 1} / {post.media.length}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {isJobPost && (
          <ContactCard phone={post.user.phone} showPhone={post.user.show_phone} className="mt-4" />
        )}

        {/* Related jobs — same category, prioritised by same city */}
        {isJobPost && relatedPosts.length > 0 && (
          <section className="mt-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t('serviceDetail.similarServices')}
            </h2>
            <div className="space-y-2">
              {relatedPosts.map(rp => (
                <Link
                  key={rp.id}
                  href={`/posts/${rp.id}`}
                  className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                    {rp.job_title || (rp.text || '').slice(0, 60) || t('common.listing')}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>{rp.author_name}</span>
                    {rp.city && <span>· {rp.city}</span>}
                    <span>· {timeAgo(rp.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <SendOfferModal
          open={offerModalOpen && post.post_type === 'job_seeker_post'}
          onOpenChange={setOfferModalOpen}
          receiverId={post.user_id}
          receiverName={post.user.name}
          postId={post.id}
        />

        <OfferServiceModal
          open={offerServiceModalOpen && post.post_type === 'service_request'}
          onOpenChange={setOfferServiceModalOpen}
          receiverId={post.user_id}
          receiverName={post.user.name}
          postId={post.id}
        />

        {selectedHiringPost && (
          <JobApplicationModal
            open={applicationModalOpen}
            onOpenChange={setApplicationModalOpen}
            postId={selectedHiringPost.id}
            postTitle={selectedHiringPost.title}
            postOwnerId={selectedHiringPost.ownerId}
            onSuccess={() => setApplicationModalOpen(false)}
          />
        )}

        <CommentsSheet
          open={commentsModalOpen}
          onOpenChange={setCommentsModalOpen}
          postId={post.id}
          commentsCount={post.comments_count || 0}
          onCommentAdded={fetchInteractiveData}
        />

        <ReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          targetType={reportType}
          targetId={reportTargetId}
          targetOwnerUserId={reportTargetUserId}
        />

        <EditPostModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          postId={post.id}
          postType={post.post_type as any}
          initialText={post.text}
          media={post.media}
          onSave={async () => { await fetchInteractiveData(); }}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('posts.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('posts.deleteConfirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('posts.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                {t('posts.confirmDelete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function SinglePostClient({ initialData, relatedPosts }: { initialData: PostInitialData; relatedPosts: RelatedPost[] }) {
  return <SinglePostContent initialData={initialData} relatedPosts={relatedPosts} />;
}
