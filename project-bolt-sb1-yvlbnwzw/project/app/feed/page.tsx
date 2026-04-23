'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Heart, MessageCircle, Share2, Loader2, Search, Volume2, VolumeX,
  MoreVertical, Plus, Star, Flag, AlertCircle, ChevronRight, Edit2,
  Trash2, Bookmark, Send, X, Eye, Home, MapPin, CheckCircle, Phone,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { CreatePostModal } from '@/components/create-post-modal';
import { ProfessionalBadge } from '@/components/professional-badge';
import { ReportModal } from '@/components/report-modal';
import { CommentsSheet } from '@/components/comments-sheet';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { fetchJSON } from '@/lib/api-client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { EditPostModal } from '@/components/edit-post-modal';
import { FeedMedia } from '@/components/FeedMedia';
import { FollowButton } from '@/components/follow-button';
import { SharePostModal } from '@/components/share-post-modal';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { useGuestGate } from '@/lib/contexts/guest-gate-context';
import { formatDistanceToNow } from 'date-fns';

export const revalidate = 0;

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  city?: string | null;
  category?: string | null;
  status?: string;
  spam_score?: number;
  rank_penalty?: number;
  phone_count?: number;
  link_count?: number;
  hashtag_count?: number;
  feed_score?: number;
  user: {
    name: string;
    email: string;
    avatar_url?: string;
    account_type: 'professional' | 'customer';
    average_rating?: number;
    review_count?: number;
  };
  media: Array<{
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
  }>;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  hashtags: string[];
  user_has_reacted: boolean;
};

const POSTS_LIMIT = 15;
const TEXT_MAX_LENGTH = 120;
const HEADER_H = 52;

function FeedContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { openGuestGate } = useGuestGate();
  usePageTracking('feed');

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [expandedText, setExpandedText] = useState<{ [key: string]: boolean }>({});

  const [isGlobalMuted, setIsGlobalMuted] = useState(true);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'profile'; id: string; userId: string } | null>(null);

  const [currentMediaIndex, setCurrentMediaIndex] = useState<{ [key: string]: number }>({});
  const [debugMode, setDebugMode] = useState(false);

  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const [activePostIndex, setActivePostIndex] = useState<number>(0);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  const [videoProgress, setVideoProgress] = useState<{ [key: string]: number }>({});
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [shareModalPostId, setShareModalPostId] = useState<string | null>(null);
  const [contactingUserId, setContactingUserId] = useState<string | null>(null);
  const newestPostTimestamp = useRef<string | null>(null);
  const viewedPostIds = useRef<Set<string>>(new Set());

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const OWNER_USER_ID = 'c5e87d26-7e51-4c05-9c4f-13e39e002c48';
  const PREFETCH_THRESHOLD = 5;

  useEffect(() => {
    loadPosts(true);
    if (user) fetchSavedPosts();
  }, [user]);

  useEffect(() => {
    loadPosts(true);
  }, [activeHashtag]);

  useEffect(() => {
    if (!user) return;
    const reactionsChannel = supabase.channel('feed-reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_reactions' }, (payload) => {
        setPosts(prev => prev.map(p => p.id === payload.new.post_id ? { ...p, reactions_count: p.reactions_count + 1 } : p));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_reactions' }, (payload) => {
        setPosts(prev => prev.map(p => p.id === payload.old.post_id ? { ...p, reactions_count: Math.max(0, p.reactions_count - 1) } : p));
      })
      .subscribe();

    const commentsChannel = supabase.channel('feed-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
        setPosts(prev => prev.map(p => p.id === payload.new.post_id ? { ...p, comments_count: p.comments_count + 1 } : p));
      })
      .subscribe();

    const newPostsChannel = supabase.channel('feed-new-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new;
        if (newPost.user_id !== user.id && newPost.post_type === 'social_post' && newPost.status === 'published' && newestPostTimestamp.current && newPost.created_at > newestPostTimestamp.current) {
          setNewPostsCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(newPostsChannel);
    };
  }, [user]);

  const fetchSavedPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id);
    setSavedSet(new Set((data || []).map((r: any) => r.post_id)));
  };

  const handleSave = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!user) return;
    const isSaved = savedSet.has(postId);
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', postId);
      setSavedSet(prev => { const s = new Set(prev); s.delete(postId); return s; });
    } else {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId });
      setSavedSet(prev => new Set(prev).add(postId));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebugMode(params.get('debug') === '1' || user?.id === OWNER_USER_ID);
  }, [user]);

  useEffect(() => {
    if (!posts.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const postId = entry.target.getAttribute('data-post-id');
          if (!postId) return;
          const postIndex = posts.findIndex(p => p.id === postId);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6 && postIndex !== -1) {
            setActivePostIndex(postIndex);
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0.6 }
    );
    const elements = document.querySelectorAll('[data-post-id]');
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [posts]);

  useEffect(() => {
    const post = posts[activePostIndex];
    if (!post || viewedPostIds.current.has(post.id)) return;
    if (user && post.user_id === user.id) return;
    viewedPostIds.current.add(post.id);
    supabase.rpc('increment_post_views', { post_id: post.id }).then(() => {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views_count: p.views_count + 1 } : p));
    });
  }, [activePostIndex, posts]);

  useEffect(() => {
    if (!posts.length || !hasMore || isFetchingNext || loadingMore || loading) return;
    if (activePostIndex >= posts.length - PREFETCH_THRESHOLD) {
      setIsFetchingNext(true);
      loadPosts(false).finally(() => setIsFetchingNext(false));
    }
  }, [activePostIndex, posts.length, hasMore, isFetchingNext, loadingMore, loading]);

  useEffect(() => {
    const updateProgress = () => {
      Object.entries(videoRefs.current).forEach(([key, video]) => {
        if (video && !video.paused && video.duration) {
          setVideoProgress(prev => ({ ...prev, [key]: (video.currentTime / video.duration) * 100 }));
        }
      });
    };
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unlock = () => setAudioUnlocked(true);
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => { window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); };
  }, []);

  useEffect(() => {
    if (!posts.length) return;
    const activePost = posts[activePostIndex];
    if (!activePost) return;
    const currentIndex = currentMediaIndex[activePost.id] || 0;
    posts.forEach((post, index) => {
      const videoKey = `${post.id}-${currentMediaIndex[post.id] || 0}`;
      const video = videoRefs.current[videoKey];
      if (!video) return;
      if (index === activePostIndex) {
        video.muted = !audioUnlocked || isGlobalMuted;
        video.play().catch(() => { video.muted = true; });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activePostIndex, posts, currentMediaIndex, audioUnlocked, isGlobalMuted]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadPosts(false); },
      { root: scrollContainerRef.current, threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset]);

  const loadPosts = async (reset = false) => {
    if (!hasMore && !reset) return;
    try {
      if (reset) { setLoading(true); setOffset(0); setHasMore(true); }
      else setLoadingMore(true);

      const currentOffset = reset ? 0 : offset;
      const hashtagParam = activeHashtag ? `&hashtag=${encodeURIComponent(activeHashtag)}` : '';
      const responseData = await fetchJSON<{ data: any[]; meta: any }>(`/api/posts?limit=${POSTS_LIMIT}&offset=${currentOffset}${hashtagParam}`);
      const newPosts = responseData.data;
      const meta = responseData.meta;

      if (!newPosts || newPosts.length === 0) { setHasMore(false); if (reset) setPosts([]); return; }

      const nextOffset = currentOffset + newPosts.length;
      setHasMore(nextOffset < (meta?.totalAvailablePosts || 0) && newPosts.length >= POSTS_LIMIT);

      let userReactedPosts = new Set<string>();
      if (user) {
        const userReactionsResult = await supabase.from('post_reactions').select('post_id').in('post_id', newPosts.map((p: any) => p.id)).eq('user_id', user.id);
        userReactedPosts = new Set((userReactionsResult.data || []).map((r: any) => r.post_id));

        const uniqueAuthorIds = [...new Set(newPosts.map((p: any) => p.user_id).filter((id: string) => id !== user.id))];
        if (uniqueAuthorIds.length > 0) {
          const { data: followData } = await supabase.from('followers').select('following_id').eq('follower_id', user.id).in('following_id', uniqueAuthorIds);
          const newlyFollowed = new Set((followData || []).map((r: any) => r.following_id));
          setFollowedUserIds(prev => {
            const next = new Set(prev);
            uniqueAuthorIds.forEach((id: string) => { if (newlyFollowed.has(id)) next.add(id); });
            return next;
          });
        }
      }

      if (reset && newPosts.length > 0) newestPostTimestamp.current = newPosts[0].created_at;

      const postsWithData = newPosts.map((post: any) => ({
        ...post,
        reactions_count: post.reactions_count || 0,
        comments_count: post.comments_count || 0,
        views_count: post.views_count || 0,
        hashtags: post.hashtags || [],
        user_has_reacted: userReactedPosts.has(post.id),
      }));

      if (reset) setPosts(postsWithData);
      else setPosts(prev => [...prev, ...postsWithData]);
      setOffset(nextOffset);
    } catch (error: any) {
      console.error('[Feed] Error loading posts:', error);
      toast.error('Greška pri učitavanju postova. Osvežite stranicu.');
      if (reset) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) { openGuestGate('like', post.id); return; }
    const isCurrentlyLiked = post.user_has_reacted;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_has_reacted: !isCurrentlyLiked, reactions_count: isCurrentlyLiked ? p.reactions_count - 1 : p.reactions_count + 1 } : p));
    try {
      if (isCurrentlyLiked) {
        const { error } = await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_reactions').insert({ post_id: post.id, user_id: user.id, reaction_type: 'like', emoji: '❤️' });
        if (error) throw error;
      }
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, user_has_reacted: isCurrentlyLiked, reactions_count: post.reactions_count } : p));
      toast.error('Greška pri čuvanju lajka.');
    }
  };

  const handleDelete = (postId: string) => { setPostToDelete(postId); setDeleteDialogOpen(true); };
  const confirmDelete = async () => {
    if (!postToDelete) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postToDelete);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
      toast.success(t('posts.deleteSuccess'));
    } catch { toast.error(t('posts.deleteError')); }
    finally { setDeleteDialogOpen(false); setPostToDelete(null); }
  };

  const handleContact = async (targetUserId: string) => {
    if (!user) { openGuestGate('message', targetUserId); return; }
    setContactingUserId(targetUserId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/messages/create-direct-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json();
      if (data.threadId) router.push(`/messages/${data.threadId}`);
      else toast.error('Greška pri otvaranju poruke.');
    } catch { toast.error('Greška pri otvaranju poruke.'); }
    finally { setContactingUserId(null); }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newMuted = !isGlobalMuted;
    setIsGlobalMuted(newMuted);
    if (!audioUnlocked) setAudioUnlocked(true);
    const activePost = posts[activePostIndex];
    if (activePost) {
      const video = videoRefs.current[`${activePost.id}-${currentMediaIndex[activePost.id] || 0}`];
      if (video) video.muted = newMuted;
    }
  };

  const togglePlayPause = (postId: string) => {
    const video = videoRefs.current[`${postId}-${currentMediaIndex[postId] || 0}`];
    if (!video) return;
    const muted = video.muted;
    if (video.paused) video.play().then(() => { video.muted = muted; }).catch(() => {});
    else video.pause();
    video.muted = muted;
  };

  const handlePostCreated = () => { setCreatePostOpen(false); router.refresh(); loadPosts(true); };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredPosts = searchQuery.trim()
    ? posts.filter(p => {
        const q = searchQuery.toLowerCase();
        return p.user.name.toLowerCase().includes(q) || (p.text || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
      })
    : posts;

  return (
    <>
      <AnnouncementBanner />

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-background/98 backdrop-blur-sm flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
            <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
                placeholder="Pretraži korisnike, gradove, kategorije..."
                autoFocus
                className="h-10 w-full rounded-xl border border-border bg-muted pl-9 pr-4 text-sm outline-none focus:border-orange-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-scroll snap-y snap-mandatory px-2 py-2 space-y-0">
            {filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <Search className="h-8 w-8 opacity-40" />
                <p className="text-sm">Nema rezultata za "<span className="text-foreground">{searchQuery}</span>"</p>
              </div>
            ) : filteredPosts.map((post, postIndex) => renderCard(post, postIndex))}
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border py-2 flex items-center justify-center gap-5">
        <button onClick={() => router.push(user ? '/dashboard' : '/')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Home className="h-5 w-5" />
        </button>
        <button onClick={() => user ? setCreatePostOpen(true) : openGuestGate('post')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors text-white shadow-md">
          <Plus className="h-5 w-5" />
        </button>
        <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* New posts notification */}
      {newPostsCount > 0 && (
        <div className="fixed left-1/2 z-30 -translate-x-1/2" style={{ top: `${HEADER_H + 8}px` }}>
          <button
            onClick={() => { setNewPostsCount(0); loadPosts(true); scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            ↑ {newPostsCount} {newPostsCount === 1 ? t('feed.newPostsSingular') : t('feed.newPostsPlural')}
          </button>
        </div>
      )}

      {/* Hashtag filter pill */}
      {activeHashtag && (
        <div className="fixed left-1/2 z-30 -translate-x-1/2" style={{ top: `${HEADER_H + 8}px` }}>
          <button onClick={() => setActiveHashtag(null)} className="flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-sm font-medium shadow-md">
            <span className="text-orange-500">#{activeHashtag}</span>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Main feed */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-scroll snap-y snap-mandatory"
        style={{ height: `calc(100dvh - ${HEADER_H}px)`, overscrollBehavior: 'contain' }}
      >
        {posts.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center px-8">
              <p className="text-xl font-bold mb-2">Nema postova</p>
              <p className="text-muted-foreground mb-4 text-sm">Feed je trenutno prazan.</p>
              {user && (
                <button onClick={() => setCreatePostOpen(true)} className="flex items-center gap-1.5 mx-auto rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Kreiraj post
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {filteredPosts.map((post, postIndex) => renderCard(post, postIndex))}

            {hasMore && (
              <div ref={loaderRef} className="flex items-center justify-center py-8" style={{ minHeight: `calc(100dvh - ${HEADER_H}px)` }}>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="flex items-center justify-center py-8" style={{ minHeight: '120px' }}>
                <p className="text-sm text-muted-foreground">Nema više postova</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {selectedPost && (
        <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} postId={selectedPost.id} commentsCount={selectedPost.comments_count}
          onCommentAdded={() => { if (selectedPost) setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, comments_count: p.comments_count + 1 } : p)); }}
        />
      )}

      <CreatePostModal open={createPostOpen} onOpenChange={setCreatePostOpen} onSuccess={handlePostCreated} />

      {reportTarget && <ReportModal open={reportModalOpen} onOpenChange={setReportModalOpen} targetType={reportTarget.type} targetId={reportTarget.id} targetOwnerUserId={reportTarget.userId} />}

      {shareModalPostId && <SharePostModal postId={shareModalPostId} open={!!shareModalPostId} onOpenChange={open => { if (!open) setShareModalPostId(null); }} />}

      {postToEdit && (
        <EditPostModal open={editModalOpen} onOpenChange={setEditModalOpen} postId={postToEdit.id} postType={undefined} initialText={postToEdit.text} media={postToEdit.media}
          onSave={async () => { await loadPosts(true); setEditModalOpen(false); }}
        />
      )}

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

      {/* CTA banner for unauthenticated users */}
      {!user && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{t('feed.ctaBannerTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('feed.ctaBannerDesc')}</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {t('feed.ctaButton')}
          </button>
        </div>
      )}
    </>
  );

  function renderCard(post: Post, postIndex: number) {
    const currentIndex = currentMediaIndex[post.id] || 0;
    const media = post.media[currentIndex];
    const hasMultipleMedia = post.media.length > 1;
    const isVideo = media?.type === 'video';
    const isPro = post.user.account_type === 'professional';
    const isOwn = user?.id === post.user_id;
    const isSaved = savedSet.has(post.id);
    const isFollowed = followedUserIds.has(post.user_id);

    const handleSwipe = (direction: 'left' | 'right') => {
      if (!hasMultipleMedia) return;
      setCurrentMediaIndex(prev => ({
        ...prev,
        [post.id]: direction === 'left'
          ? Math.min(currentIndex + 1, post.media.length - 1)
          : Math.max(currentIndex - 1, 0)
      }));
    };

    const handleTouchStart = (e: React.TouchEvent) => { if (hasMultipleMedia) touchStartX.current = e.touches[0].clientX; };
    const handleTouchMove = (e: React.TouchEvent) => { if (hasMultipleMedia) touchEndX.current = e.touches[0].clientX; };
    const handleTouchEnd = () => {
      if (!hasMultipleMedia || touchStartX.current === null || touchEndX.current === null) return;
      const diff = touchStartX.current - touchEndX.current;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < post.media.length - 1) handleSwipe('left');
        else if (diff < 0 && currentIndex > 0) handleSwipe('right');
      }
      touchStartX.current = null; touchEndX.current = null;
    };

    return (
      <div
        key={post.id}
        data-post-id={post.id}
        ref={el => { postRefs.current[post.id] = el; }}
        className="snap-start flex justify-center px-2 py-1"
        style={{ height: `calc(100dvh - ${HEADER_H}px)` }}
      >
        <div className={`w-full max-w-md h-full flex flex-col rounded-2xl overflow-hidden shadow-sm bg-card border border-border ${isPro ? 'border-l-4 border-l-orange-500' : 'border-l-4 border-l-blue-500'}`}>

          {/* Card header */}
          <div className="flex items-center gap-2.5 p-3 shrink-0">
            <Avatar
              className="h-9 w-9 shrink-0 cursor-pointer"
              onClick={() => router.push(`/profile/${post.user_id}`)}
            >
              <AvatarImage src={post.user.avatar_url} />
              <AvatarFallback>{post.user.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <button className="font-semibold text-sm text-foreground truncate hover:text-orange-500 transition-colors" onClick={() => router.push(`/profile/${post.user_id}`)}>
                  {post.user.name}
                </button>
                {isPro && <CheckCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                {isPro
                  ? <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0 h-4 shrink-0">PRO</Badge>
                  : <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0 h-4 shrink-0">Klijent</Badge>
                }
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isPro && post.user.average_rating && post.user.average_rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {post.user.average_rating.toFixed(1)}
                  </span>
                )}
                {post.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{post.city}</span>}
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isOwn && isPro && (
                <FollowButton
                  targetUserId={post.user_id}
                  currentUserId={user?.id || ''}
                  size="sm"
                  isFollowing={isFollowed}
                  onFollowChange={following => {
                    setFollowedUserIds(prev => {
                      const next = new Set(prev);
                      if (following) next.add(post.user_id); else next.delete(post.user_id);
                      return next;
                    });
                  }}
                />
              )}
              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground p-1">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwn ? (
                    <>
                      <DropdownMenuItem onClick={() => { setPostToEdit(post); setEditModalOpen(true); }} className="cursor-pointer">
                        <Edit2 className="mr-2 h-4 w-4" />{t('posts.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(post.id)} className="cursor-pointer text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" />{t('posts.delete')}
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => { setReportTarget({ type: 'post', id: post.id, userId: post.user_id }); setReportModalOpen(true); }} className="cursor-pointer">
                        <Flag className="mr-2 h-4 w-4" />{t('report.reportPost')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setReportTarget({ type: 'profile', id: post.user_id, userId: post.user_id }); setReportModalOpen(true); }} className="cursor-pointer">
                        <AlertCircle className="mr-2 h-4 w-4" />{t('report.reportUser')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Media or text-only area */}
          {!media && post.text && (
            <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-gradient-to-br from-muted/30 to-muted/10">
              <p className="text-foreground text-base leading-relaxed text-center whitespace-pre-line">{post.text}</p>
            </div>
          )}

          {media && (
            <div
              className="flex-1 min-h-0 relative overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => { if (isVideo) togglePlayPause(post.id); }}
            >
              {isVideo ? (
                <FeedMedia
                  type="video"
                  src={media.url}
                  alt="Post"
                  isMuted={isGlobalMuted}
                  videoRef={el => { if (el) videoRefs.current[`${post.id}-${currentIndex}`] = el; }}
                />
              ) : (
                <img
                  src={media.url}
                  alt="Post"
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              )}

              {/* Overlay text */}
              {media.overlay_text && (
                <div className="pointer-events-none absolute z-10" style={{ left: `${media.overlay_x ?? 50}%`, top: `${media.overlay_y ?? 50}%`, width: `${media.overlay_width ?? 80}%`, transform: 'translate(-50%, -50%)' }}>
                  <p className="font-bold px-3 py-1 rounded-lg bg-black/30" style={{ color: media.overlay_color || '#FFF', fontSize: `${media.overlay_font_size ?? 24}px`, textAlign: media.overlay_align || 'center', textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                    {media.overlay_text}
                  </p>
                </div>
              )}

              {/* Multi-media dots */}
              {hasMultipleMedia && (
                <>
                  <div className="absolute top-2 left-0 right-0 flex justify-center gap-1 z-10 pointer-events-none">
                    {post.media.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all ${i === currentIndex ? 'w-5 bg-white' : 'w-2 bg-white/50'}`} />
                    ))}
                  </div>
                  {currentIndex > 0 && <button onClick={() => handleSwipe('right')} className="absolute left-0 top-0 bottom-0 w-1/4 z-20" aria-label="Previous" />}
                  {currentIndex < post.media.length - 1 && <button onClick={() => handleSwipe('left')} className="absolute right-0 top-0 bottom-0 w-1/4 z-20" aria-label="Next" />}
                  {currentIndex < post.media.length - 1 && (
                    <div className="pointer-events-none absolute right-3 bottom-3 z-10">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/50 border border-white/20">
                        <ChevronRight className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Video progress bar */}
              {isVideo && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20 z-10">
                  <div className="h-full bg-white transition-all duration-100" style={{ width: `${videoProgress[`${post.id}-${currentIndex}`] || 0}%` }} />
                </div>
              )}

              {/* Mute button for video */}
              {isVideo && (
                <button onClick={e => toggleMute(e)} className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50">
                  {isGlobalMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
                </button>
              )}

              {/* Debug overlay */}
              {debugMode && (
                <div className="pointer-events-none absolute left-2 top-2 z-40 rounded bg-red-600 px-2 py-1 text-xs font-mono text-white">
                  spam:{post.spam_score ?? 'N/A'} | penalty:{post.rank_penalty ?? 'N/A'}
                </div>
              )}
            </div>
          )}

          {/* Text (after media — only if media exists) */}
          {media && post.text && (
            <div className="px-3 pt-2 pb-1 shrink-0">
              {(() => {
                const isLong = (post.text?.length || 0) > TEXT_MAX_LENGTH;
                const isExpanded = expandedText[post.id];
                return (
                  <>
                    <p className={`text-sm text-foreground ${isLong && !isExpanded ? 'line-clamp-2' : ''}`}>{post.text}</p>
                    {isLong && (
                      <button onClick={() => setExpandedText(prev => ({ ...prev, [post.id]: !prev[post.id] }))} className="text-xs text-orange-500 font-semibold mt-0.5">
                        {isExpanded ? t('posts.showLess') : t('posts.readMore')}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {post.category && (
            <div className="px-3 pb-1 shrink-0">
              <Badge variant="outline" className="text-xs">{post.category}</Badge>
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-1 shrink-0">
              {post.hashtags.map(tag => (
                <button key={tag} onClick={() => setActiveHashtag(activeHashtag === tag ? null : tag)}
                  className={`text-xs font-semibold ${activeHashtag === tag ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'}`}>
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center px-3 py-2 border-t border-border gap-1 shrink-0">
            <button onClick={() => user ? handleLike(post) : openGuestGate('like', post.id)} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <Heart className={`h-4 w-4 ${post.user_has_reacted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              <span className="text-muted-foreground">{post.reactions_count}</span>
            </button>
            <button onClick={() => user ? (setSelectedPost(post), setCommentsOpen(true)) : openGuestGate('comment', post.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <MessageCircle className="h-4 w-4" />{post.comments_count}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 opacity-70">
              <Eye className="h-4 w-4" />{post.views_count}
            </div>
            <div className="flex-1" />
            <button onClick={e => user ? handleSave(e, post.id) : openGuestGate('save', post.id)} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
            </button>
            <button onClick={() => setShareModalPostId(post.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            {isPro && !isOwn && user && (
              <button
                onClick={() => handleContact(post.user_id)}
                disabled={contactingUserId === post.user_id}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
              >
                {contactingUserId === post.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                {t('feed.contact')}
              </button>
            )}
            {isPro && !user && (
              <button
                onClick={() => openGuestGate('contact', post.user_id)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                {t('feed.contact')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default function FeedPage() {
  return <FeedContent />;
}
