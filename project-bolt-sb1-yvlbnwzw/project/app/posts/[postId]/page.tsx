'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { PostReactions } from '@/components/post-reactions';
import { PostCommentsButton } from '@/components/post-comments-button';
import { ReportModal } from '@/components/report-modal';
import { CommentsSheet } from '@/components/comments-sheet';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Pin, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, DollarSign, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { OfferServiceModal } from '@/components/offer-service-modal';
import { EditPostModal } from '@/components/edit-post-modal';
import { useLanguage } from '@/lib/contexts/language-context';

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
  avatar_url?: string;
  account_type: 'professional' | 'customer';
  average_rating?: number;
  review_count?: number;
};

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  is_pinned: boolean;
  pinned_at: string | null;
  post_type: string;
  user: PostUser;
  media: PostMedia[];
  reactions_count: number;
  comments_count: number;
  user_has_reacted: boolean;
};

function SinglePostContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const postId = params.postId as string;
  const commentId = searchParams.get('commentId');
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
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    console.log('[PostDetail] Fetching post:', postId);
    fetchPost();
  }, [postId]);

  useEffect(() => {
    if (!post) return;
    if (post.post_type === 'social_post' && !post.text && post.media.length === 0) {
      router.replace('/feed');
      return;
    }
    if (post.post_type === 'social_post' && post.media.length > 0) {
      console.log('[PostDetail] Triggering resize event for media');
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [post]);

  const fetchPost = async () => {
    try {
      console.log('[PostDetail] Starting fetchPost for:', postId);
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          created_at,
          is_pinned,
          pinned_at,
          post_type,
          user:profiles!posts_user_id_fkey(id, name, email, avatar_url, account_type, average_rating, review_count)
        `)
        .eq('id', postId)
        .maybeSingle();

      if (postError) {
        console.error('[PostDetail] Error fetching post:', postError);
        throw postError;
      }

      if (!postData) {
        console.log('[PostDetail] Post not found for ID:', postId);
        setError('Post not found');
        setLoading(false);
        return;
      }

      console.log('[PostDetail] Post data received:', postData);

      const [mediaResult, reactionsResult, commentsResult, userReactionResult] = await Promise.all([
        supabase
          .from('post_media')
          .select('*')
          .eq('post_id', postId)
          .order('order', { ascending: true }),

        supabase
          .from('post_reactions')
          .select('id')
          .eq('post_id', postId),

        supabase
          .from('post_comments')
          .select('id')
          .eq('post_id', postId),

        user ? supabase
          .from('post_reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle() : Promise.resolve({ data: null })
      ]);

      const userData = Array.isArray(postData.user) ? postData.user[0] : postData.user;

      const finalPost = {
        ...postData,
        user: userData,
        media: mediaResult.data || [],
        reactions_count: reactionsResult.data?.length || 0,
        comments_count: commentsResult.data?.length || 0,
        user_has_reacted: !!userReactionResult.data,
      } as Post;

      console.log('[PostDetail] Final post object:', finalPost);
      console.log('[PostDetail] Post type:', finalPost.post_type);
      setPost(finalPost);

      // Increment view count (fire-and-forget, non-blocking)
      supabase.rpc('increment_post_views', { post_id: postId });
    } catch (error: any) {
      console.error('[PostDetail] Error fetching post:', error);
      setError('Failed to load post');
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
      const response = await fetch(`/api/posts/${postId}/get-or-create-thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      const { threadId } = await response.json();
      router.push(`/messages/${threadId}`);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      toast.error(error.message || 'Greška pri kreiranju razgovora');
    } finally {
      setContactLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background" />
    );
  }

  if (error || !post) {
    console.log('[PostDetail] Rendering error state:', { error, post });
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button
            variant="ghost"
            onClick={() => handleBack()}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Post not found'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  console.log('[PostDetail] Rendering post:', post.id, 'Type:', post.post_type);

  const handleReport = (type: 'post' | 'profile', id: string, userId: string) => {
    setReportType(type);
    setReportTargetId(id);
    setReportTargetUserId(userId);
    setReportModalOpen(true);
  };

  const handleEdit = (post: Post) => {
    setEditModalOpen(true);
  };

  const handleDelete = async (postId: string) => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!post) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast.success(t('posts.deleteSuccess'));
      router.push('/feed');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(t('posts.deleteError'));
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleLike = () => {
    fetchPost();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/feed');
    }
  };

  if (post?.post_type === 'social_post' && post.media.length > 0) {
    const currentMedia = post.media[currentMediaIndex];
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button onClick={() => handleBack()} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-orange-500 text-white text-xs">
                {post.user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{post.user.name}</p>
            </div>
          </div>

          {/* Media */}
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
              <video
                src={currentMedia.url}
                controls
                playsInline
                className="w-full max-h-[80vh] object-contain"
              />
            ) : (
              <img
                src={currentMedia.url}
                alt="Post media"
                className="w-full h-auto max-h-[80vh] object-contain"
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

          {/* Actions + text */}
          <div className="px-4 py-3 space-y-2">
            <PostReactions postId={post.id} />
            {post.text && <p className="text-sm text-foreground whitespace-pre-wrap">{post.text}</p>}
            <PostCommentsButton postId={post.id} commentsCount={post.comments_count || 0} />
          </div>
        </div>

        <CommentsSheet open={commentsModalOpen} onOpenChange={setCommentsModalOpen} postId={post.id} commentsCount={post.comments_count || 0} onCommentAdded={fetchPost} />
        <ReportModal open={reportModalOpen} onOpenChange={setReportModalOpen} targetType={reportType} targetId={reportTargetId} targetOwnerUserId={reportTargetUserId} />
        <EditPostModal open={editModalOpen} onOpenChange={setEditModalOpen} postId={post.id} postType={post.post_type as any} initialText={post.text} media={post.media} onSave={async () => { await fetchPost(); }} />
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

  return (
    <div className="bg-slate-50 py-8 pb-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => handleBack()}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-600 text-white">
                  {post.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{post.user.name}</p>
                      {post.is_pinned && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {user && post.user_id !== user.id && (
                    <div className="flex gap-2">
                      {post.post_type === 'job_seeker_post' && (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOfferModalOpen(true);
                          }}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <DollarSign className="h-4 w-4" />
                          {t('jobs.offerJobButton')}
                        </Button>
                      )}
                      {post.post_type === 'service_request' && (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOfferServiceModalOpen(true);
                          }}
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Briefcase className="h-4 w-4" />
                          {t('jobs.offerServiceButton')}
                        </Button>
                      )}
                      <Button
                        onClick={handleContactAuthor}
                        disabled={contactLoading}
                        className="gap-2 bg-orange-600 hover:bg-orange-700"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {contactLoading ? t('common.loading') : t('jobs.sendMessageButton')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {post.text && (
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">{post.text}</p>
            </CardContent>
          )}

          {post.media.length > 0 && (
            <CardContent className="pt-0">
              <div className="relative rounded-lg overflow-hidden bg-slate-100">
                {post.media.length === 1 ? (
                  <div className="relative">
                    {post.media[0].type === 'image' ? (
                      <img
                        src={post.media[0].url}
                        alt="Post media"
                        className="w-full h-auto object-cover"
                      />
                    ) : (
                      <video
                        src={post.media[0].url}
                        controls
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className="relative"
                    onTouchStart={(e) => {
                      touchStartX.current = e.touches[0].clientX;
                    }}
                    onTouchMove={(e) => {
                      touchEndX.current = e.touches[0].clientX;
                    }}
                    onTouchEnd={() => {
                      if (touchStartX.current === null || touchEndX.current === null) return;
                      const diff = touchStartX.current - touchEndX.current;
                      const minSwipeDistance = 50;

                      if (Math.abs(diff) > minSwipeDistance) {
                        if (diff > 0 && currentMediaIndex < post.media.length - 1) {
                          setCurrentMediaIndex(prev => prev + 1);
                        } else if (diff < 0 && currentMediaIndex > 0) {
                          setCurrentMediaIndex(prev => prev - 1);
                        }
                      }

                      touchStartX.current = null;
                      touchEndX.current = null;
                    }}
                  >
                    {post.media[currentMediaIndex].type === 'image' ? (
                      <img
                        src={post.media[currentMediaIndex].url}
                        alt="Post media"
                        className="w-full h-auto object-cover"
                      />
                    ) : (
                      <video
                        src={post.media[currentMediaIndex].url}
                        controls
                        className="w-full h-auto"
                      />
                    )}

                    {/* Navigation Buttons */}
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

                    {/* Indicator Dots */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {post.media.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentMediaIndex(index)}
                          className={`h-2 rounded-full transition-all ${
                            index === currentMediaIndex
                              ? 'w-6 bg-white'
                              : 'w-2 bg-white/50'
                          }`}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>

                    {/* Counter */}
                    <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                      {currentMediaIndex + 1} / {post.media.length}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}

          <CardContent className="pt-0 space-y-4">
            <PostReactions postId={post.id} />
            <PostCommentsButton postId={post.id} commentsCount={post.comments_count || 0} />
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}

export default function SinglePostPage() {
  return <SinglePostContent />;
}
