'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Loader2,
  Search,
  Volume2,
  VolumeX,
  MoreVertical,
  Plus,
  Star,
  Flag,
  AlertCircle,
  ChevronRight,
  Edit2,
  Trash2,
  Bookmark,
  Send,
  X,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { CreatePostModal } from '@/components/create-post-modal';
import { Input } from '@/components/ui/input';
import { ProfessionalBadge } from '@/components/professional-badge';
import { ReportModal } from '@/components/report-modal';
import { CommentsSheet } from '@/components/comments-sheet';
import { useLanguage } from '@/lib/contexts/language-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { fetchJSON } from '@/lib/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { EditPostModal } from '@/components/edit-post-modal';
import { FeedMedia } from '@/components/FeedMedia';
import { FollowButton } from '@/components/follow-button';
import { SharePostModal } from '@/components/share-post-modal';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';

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
const TEXT_MAX_LENGTH = 100;

function FeedContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'profile'; id: string; userId: string } | null>(null);

  const [currentMediaIndex, setCurrentMediaIndex] = useState<{ [key: string]: number }>({});
  const [swipedPosts, setSwipedPosts] = useState<Set<string>>(new Set());
  const [debugMode, setDebugMode] = useState(false);

  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [submittingComment, setSubmittingComment] = useState<{ [postId: string]: boolean }>({});

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const [activePostIndex, setActivePostIndex] = useState<number>(0);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  const [videoProgress, setVideoProgress] = useState<{ [key: string]: number }>({});
  const [imageProgress, setImageProgress] = useState<{ [key: string]: number }>({});
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [shareModalPostId, setShareModalPostId] = useState<string | null>(null);
  const [contactingUserId, setContactingUserId] = useState<string | null>(null);
  const newestPostTimestamp = useRef<string | null>(null);
  const viewedPostIds = useRef<Set<string>>(new Set());

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const imageTimerRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({});
  const swipeHintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const OWNER_USER_ID = 'c5e87d26-7e51-4c05-9c4f-13e39e002c48';
  const PREFETCH_THRESHOLD = 5;

  useEffect(() => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    preloadVideoRef.current = video;

    return () => {
      preloadVideoRef.current = null;
    };
  }, []);

  const prefetchImages = (_postsToFetch: Post[]) => {
    return;
  };

  useEffect(() => {
    if (user) {
      loadPosts(true);
      fetchSavedPosts();
    }
  }, [user]);

  // Reload when hashtag filter changes
  useEffect(() => {
    if (user) loadPosts(true);
  }, [activeHashtag]);

  // Realtime: live like/comment count updates + new posts detection
  useEffect(() => {
    if (!user) return;

    const reactionsChannel = supabase
      .channel('feed-reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_reactions' }, (payload) => {
        setPosts(prev => prev.map(p =>
          p.id === payload.new.post_id ? { ...p, reactions_count: p.reactions_count + 1 } : p
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_reactions' }, (payload) => {
        setPosts(prev => prev.map(p =>
          p.id === payload.old.post_id ? { ...p, reactions_count: Math.max(0, p.reactions_count - 1) } : p
        ));
      })
      .subscribe();

    const commentsChannel = supabase
      .channel('feed-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
        setPosts(prev => prev.map(p =>
          p.id === payload.new.post_id ? { ...p, comments_count: p.comments_count + 1 } : p
        ));
      })
      .subscribe();

    const newPostsChannel = supabase
      .channel('feed-new-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new;
        if (
          newPost.user_id !== user.id &&
          newPost.post_type === 'social_post' &&
          newPost.status === 'published' &&
          newestPostTimestamp.current &&
          newPost.created_at > newestPostTimestamp.current
        ) {
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
    const { data } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id);
    setSavedSet(new Set((data || []).map((r: any) => r.post_id)));
  };

  const handleSave = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!user) return;
    const isSaved = savedSet.has(postId);
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', postId);
      setSavedSet((prev) => { const s = new Set(prev); s.delete(postId); return s; });
    } else {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId });
      setSavedSet((prev) => new Set(prev).add(postId));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasDebug = params.get('debug') === '1';
    const isOwner = user?.id === OWNER_USER_ID;
    setDebugMode(hasDebug || isOwner);
  }, [user]);

  useEffect(() => {
    if (posts.length === 0) return;

    const feedHintSeen = localStorage.getItem('feedHintSeen');
    if (feedHintSeen) return;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    setShowSwipeHint(true);

    swipeHintTimerRef.current = setTimeout(() => {
      setShowSwipeHint(false);
      localStorage.setItem('feedHintSeen', '1');
    }, 3000);

    return () => {
      if (swipeHintTimerRef.current) {
        clearTimeout(swipeHintTimerRef.current);
      }
    };
  }, [posts]);

  useEffect(() => {
    if (swipeCount >= 2) {
      setShowSwipeHint(false);
      localStorage.setItem('feedHintSeen', '1');
      if (swipeHintTimerRef.current) {
        clearTimeout(swipeHintTimerRef.current);
      }
    }
  }, [swipeCount]);

  useEffect(() => {
    if (!posts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute('data-post-id');
          if (!postId) return;

          const postIndex = posts.findIndex((p) => p.id === postId);

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (postIndex !== -1) setActivePostIndex(postIndex);
          }
        });
      },
      { root: null, threshold: 0.6, rootMargin: '0px' }
    );

    const elements = document.querySelectorAll('[data-post-id]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts, currentMediaIndex]);

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

    const shouldPrefetch = activePostIndex >= posts.length - PREFETCH_THRESHOLD;

    if (shouldPrefetch) {
      setIsFetchingNext(true);
      loadPosts(false).finally(() => {
        setIsFetchingNext(false);
      });
    }
  }, [activePostIndex, posts.length, hasMore, isFetchingNext, loadingMore, loading]);

  useEffect(() => {
    const updateProgress = () => {
      Object.entries(videoRefs.current).forEach(([key, video]) => {
        if (video && !video.paused && video.duration) {
          const progress = (video.currentTime / video.duration) * 100;
          setVideoProgress((prev) => ({ ...prev, [key]: progress }));
        }
      });
    };

    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      setAudioUnlocked(true);
    };

    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('click', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!posts.length) return;

    const activePost = posts[activePostIndex];
    if (!activePost) return;

    const currentIndex = currentMediaIndex[activePost.id] || 0;
    const media = activePost.media[currentIndex];

    if (!media || media.type !== 'image') return;

    const imageKey = `${activePost.id}-${currentIndex}`;

    if (imageTimerRefs.current[imageKey]) {
      clearInterval(imageTimerRefs.current[imageKey]!);
    }

    setImageProgress((prev) => ({ ...prev, [imageKey]: 0 }));

    const duration = 4000;
    const updateInterval = 50;
    const incrementPerUpdate = (100 / duration) * updateInterval;
    let currentProgress = 0;

    const timer = setInterval(() => {
      currentProgress += incrementPerUpdate;

      if (currentProgress >= 100) {
        currentProgress = 100;
        setImageProgress((prev) => ({ ...prev, [imageKey]: 100 }));
        clearInterval(timer);
      } else {
        setImageProgress((prev) => ({ ...prev, [imageKey]: currentProgress }));
      }
    }, updateInterval);

    imageTimerRefs.current[imageKey] = timer;

    return () => {
      if (imageTimerRefs.current[imageKey]) {
        clearInterval(imageTimerRefs.current[imageKey]!);
        imageTimerRefs.current[imageKey] = null;
      }
    };
  }, [activePostIndex, posts, currentMediaIndex]);

  useEffect(() => {
    if (!posts.length) return;

    posts.forEach((post, index) => {
      const currentIndex = currentMediaIndex[post.id] || 0;
      const videoKey = `${post.id}-${currentIndex}`;
      const video = videoRefs.current[videoKey];

      if (!video) return;

      if (index === activePostIndex) {
        video.muted = !audioUnlocked || isGlobalMuted;

        video.play().catch(() => {
          video.muted = true;
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activePostIndex, posts, currentMediaIndex, audioUnlocked, isGlobalMuted]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore) {
          loadPosts(false);
        }
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: '200px'
      }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset]);

  const loadPosts = async (reset: boolean = false) => {
    if (!user) return;
    if (!hasMore && !reset) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const hashtagParam = activeHashtag ? `&hashtag=${encodeURIComponent(activeHashtag)}` : '';
      const url = `/api/posts?limit=${POSTS_LIMIT}&offset=${currentOffset}${hashtagParam}`;

      const responseData = await fetchJSON<{
        data: any[];
        build_marker?: string;
        meta: {
          totalPostsInDB: number;
          totalAvailablePosts: number;
          returnedCount: number;
          limit: number;
          offset: number;
        };
      }>(url);

      const newPosts = responseData.data;
      const meta = responseData.meta;

      if (!newPosts || newPosts.length === 0) {
        setHasMore(false);
        if (reset) setPosts([]);
        return;
      }

      const nextOffset = currentOffset + newPosts.length;
      const totalAvailable = meta?.totalAvailablePosts || 0;

      if (nextOffset >= totalAvailable || newPosts.length < POSTS_LIMIT) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      const postIds = newPosts.map((p: any) => p.id);

      const userReactionsResult = await supabase
        .from('post_reactions')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', user.id);

      const userReactedPosts = new Set((userReactionsResult.data || []).map((r: any) => r.post_id));

      // Batch-fetch follow status for all unique authors in this page
      const uniqueAuthorIds = [...new Set(
        newPosts.map((p: any) => p.user_id).filter((id: string) => id !== user.id)
      )];
      if (uniqueAuthorIds.length > 0) {
        const { data: followData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', uniqueAuthorIds);
        const newlyFollowed = new Set((followData || []).map((r: any) => r.following_id));
        setFollowedUserIds(prev => {
          const next = new Set(prev);
          uniqueAuthorIds.forEach((id: string) => {
            if (newlyFollowed.has(id)) next.add(id);
            // Don't remove IDs already known from previous pages
          });
          return next;
        });
      }

      // Track newest post timestamp for "new posts" detection
      if (reset && newPosts.length > 0) {
        newestPostTimestamp.current = newPosts[0].created_at;
      }

      const postsWithData = newPosts.map((post: any) => ({
        ...post,
        reactions_count: post.reactions_count || 0,
        comments_count: post.comments_count || 0,
        views_count: post.views_count || 0,
        hashtags: post.hashtags || [],
        user_has_reacted: userReactedPosts.has(post.id),
      }));

      if (reset) {
        setPosts(postsWithData);
      } else {
        setPosts((prev) => [...prev, ...postsWithData]);
      }

      setOffset(nextOffset);
      prefetchImages(postsWithData);
    } catch (error: any) {
      console.error('[Feed] Error loading posts:', error);
      toast.error('Greška pri učitavanju postova. Osvežite stranicu.');
      if (reset) {
        setPosts([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) {
      toast.error('Moraš biti ulogovan da bi lajkovao.');
      return;
    }

    const isCurrentlyLiked = post.user_has_reacted;
    const newCount = isCurrentlyLiked ? post.reactions_count - 1 : post.reactions_count + 1;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, user_has_reacted: !isCurrentlyLiked, reactions_count: newCount }
          : p
      )
    );

    try {
      if (isCurrentlyLiked) {
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: post.id,
            user_id: user.id,
            reaction_type: 'like',
            emoji: '❤️'
          });

        if (error) throw error;
      }
    } catch (error) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, user_has_reacted: isCurrentlyLiked, reactions_count: post.reactions_count }
            : p
        )
      );
      toast.error('Greška pri čuvanju lajka.');
    }
  };

  const handleEdit = (post: Post) => {
    setPostToEdit(post);
    setEditModalOpen(true);
  };

  const handleDelete = (postId: string) => {
    setPostToDelete(postId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete);

      if (error) throw error;

      setPosts((prev) => prev.filter((p) => p.id !== postToDelete));
      toast.success(t('posts.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(t('posts.deleteError'));
    } finally {
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    }
  };

  const handleShare = (post: Post) => {
    setShareModalPostId(post.id);
  };

  const handleContact = async (targetUserId: string) => {
    if (!user) return;
    setContactingUserId(targetUserId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/messages/create-direct-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json();
      if (data.threadId) {
        router.push(`/messages/${data.threadId}`);
      } else {
        toast.error('Greška pri otvaranju poruke.');
      }
    } catch {
      toast.error('Greška pri otvaranju poruke.');
    } finally {
      setContactingUserId(null);
    }
  };

  const openComments = (post: Post) => {
    setSelectedPost(post);
    setCommentsOpen(true);
  };

  const handleCommentAdded = () => {
    if (selectedPost) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? { ...p, comments_count: p.comments_count + 1 }
            : p
        )
      );
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const newMutedState = !isGlobalMuted;
    setIsGlobalMuted(newMutedState);
    if (!audioUnlocked) setAudioUnlocked(true);

    const activePost = posts[activePostIndex];
    if (activePost) {
      const currentIndex = currentMediaIndex[activePost.id] || 0;
      const videoKey = `${activePost.id}-${currentIndex}`;
      const video = videoRefs.current[videoKey];
      if (video) {
        video.muted = newMutedState;
      }
    }
  };

  const togglePlayPause = (postId: string) => {
    const currentIndex = currentMediaIndex[postId] || 0;
    const videoKey = `${postId}-${currentIndex}`;
    const video = videoRefs.current[videoKey];
    if (!video) return;

    const currentMuted = video.muted;

    if (video.paused) {
      video.play().then(() => {
        video.muted = currentMuted;
      }).catch(() => {});
    } else {
      video.pause();
    }

    video.muted = currentMuted;
  };

  const handlePostCreated = () => {
    setCreatePostOpen(false);
    router.refresh();
    loadPosts(true);
  };

  const handleInlineComment = async (postId: string) => {
    if (!user) return;
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, text });

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)
      );
    } catch {
      toast.error('Greška pri dodavanju komentara');
      setCommentInputs((prev) => ({ ...prev, [postId]: text }));
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const filteredPosts = searchQuery.trim()
    ? posts.filter(p => {
        const q = searchQuery.toLowerCase();
        return (
          p.user.name.toLowerCase().includes(q) ||
          (p.text || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
        );
      })
    : posts;

  const emptyState = !loading && posts.length === 0;
  const activeHeaderPost = posts[activePostIndex];
  const activeHeaderIndex = activeHeaderPost ? (currentMediaIndex[activeHeaderPost.id] || 0) : 0;
  const showHeaderCounter = !!activeHeaderPost && activeHeaderPost.media?.length > 1;

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[110]">
        <AnnouncementBanner />
      </div>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[100]">
        <div
          className="mx-auto w-full max-w-[430px] px-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}
        >
          {searchOpen ? (
            /* ── Search mode header ── */
            <div className="pointer-events-auto flex items-center gap-2 py-2">
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
                  placeholder="Pretraži korisnike, gradove, kategorije..."
                  autoFocus
                  className="h-11 w-full rounded-full border border-white/20 bg-black/60 pl-9 pr-4 text-sm text-white placeholder-white/40 outline-none backdrop-blur-md focus:border-orange-400/50 focus:bg-black/80"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Normal header ── */
            <div className="pointer-events-auto grid grid-cols-[44px_1fr_44px] items-center gap-2 py-2">
              {/* Back */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/dashboard')}
                className="h-11 w-11 rounded-full text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              {/* Create post — centered */}
              <button
                onClick={() => setCreatePostOpen(true)}
                className="mx-auto flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Post
              </button>

              {/* Search */}
              <div className="flex flex-col items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New posts notification */}
      {newPostsCount > 0 && (
        <div className="pointer-events-auto fixed left-1/2 z-[99] -translate-x-1/2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 68px)' }}>
          <button
            onClick={() => {
              setNewPostsCount(0);
              loadPosts(true);
              scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg active:scale-95 transition-all hover:bg-orange-700"
          >
            ↑ {newPostsCount} {newPostsCount === 1 ? t('feed.newPostsSingular') : t('feed.newPostsPlural')}
          </button>
        </div>
      )}

      {/* Active hashtag filter pill */}
      {activeHashtag && (
        <div className="pointer-events-auto fixed left-1/2 z-[99] -translate-x-1/2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 68px)' }}>
          <button
            onClick={() => setActiveHashtag(null)}
            className="flex items-center gap-1.5 rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md"
          >
            <span className="text-orange-400">#{activeHashtag}</span>
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>
        </div>
      )}

      <div className="fixed inset-0 snap-y snap-mandatory overflow-y-scroll bg-black" ref={scrollContainerRef}>
        {emptyState ? (
          <div className="isolate flex h-[100dvh] w-screen snap-start items-center justify-center bg-black transform-gpu">
            <div className="max-w-md px-8 text-center">
              <p className="mb-4 text-2xl font-bold text-white">No Posts</p>
              <p className="mb-6 text-gray-400">The feed is currently empty. Be the first to post!</p>
              <button
                onClick={() => setCreatePostOpen(true)}
                className="mx-auto flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Plus className="h-4 w-4" />
                Create Post
              </button>
            </div>
          </div>
        ) : searchQuery.trim() && filteredPosts.length === 0 ? (
          <div className="isolate flex h-[100dvh] w-screen snap-start items-center justify-center bg-black transform-gpu">
            <div className="max-w-md px-8 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-white/30" />
              <p className="mb-2 text-lg font-semibold text-white">Nema rezultata</p>
              <p className="text-sm text-white/50">Nema postova koji odgovaraju "<span className="text-white/80">{searchQuery}</span>"</p>
            </div>
          </div>
        ) : filteredPosts.map((post, postIndex) => {
          const currentIndex = currentMediaIndex[post.id] || 0;
          const media = post.media[currentIndex];
          const hasMultipleMedia = post.media.length > 1;
          const isVideo = media?.type === 'video';

          const handleSwipe = (direction: 'left' | 'right') => {
            if (!hasMultipleMedia) return;

            setSwipedPosts((prev) => new Set(prev).add(post.id));
            setSwipeCount((prev) => prev + 1);

            setCurrentMediaIndex((prev) => {
              const newIndex = direction === 'left'
                ? Math.min(currentIndex + 1, post.media.length - 1)
                : Math.max(currentIndex - 1, 0);

              return { ...prev, [post.id]: newIndex };
            });
          };

          const handleTouchStart = (e: React.TouchEvent) => {
            if (!hasMultipleMedia) return;
            touchStartX.current = e.touches[0].clientX;
          };

          const handleTouchMove = (e: React.TouchEvent) => {
            if (!hasMultipleMedia) return;
            touchEndX.current = e.touches[0].clientX;
          };

          const handleTouchEnd = () => {
            if (!hasMultipleMedia || touchStartX.current === null || touchEndX.current === null) return;

            const diff = touchStartX.current - touchEndX.current;
            const minSwipeDistance = 50;

            if (Math.abs(diff) > minSwipeDistance) {
              if (diff > 0 && currentIndex < post.media.length - 1) {
                handleSwipe('left');
              } else if (diff < 0 && currentIndex > 0) {
                handleSwipe('right');
              }
            }

            touchStartX.current = null;
            touchEndX.current = null;
          };

          return (
            <div
              key={post.id}
              className="flex h-[100svh] w-screen snap-start items-center justify-center bg-black"
              data-post-id={post.id}
              ref={(el) => {
                postRefs.current[post.id] = el;
              }}
            >
              <div
                className="feedStage relative h-[100svh] w-full max-w-[430px] overflow-hidden bg-black"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a, [data-no-playpause]')) return;
                  if (isVideo) togglePlayPause(post.id);
                }}
              >
                {media ? (
                  <FeedMedia
                    type={isVideo ? 'video' : 'image'}
                    src={media.url}
                    alt="Post"
                    isMuted={isGlobalMuted}
                    videoRef={(el) => {
                      if (el && isVideo) {
                        videoRefs.current[`${post.id}-${currentIndex}`] = el;
                      }
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black p-8">
                    <p className="text-center text-2xl leading-relaxed text-white">
                      {post.text || 'Post bez sadržaja'}
                    </p>
                  </div>
                )}

                <div className="absolute inset-0 z-30">
                  <div />

                  {media?.overlay_text && (
                    <div
                      className="pointer-events-none absolute z-[15]"
                      style={{
                        left: `${media.overlay_x ?? 50}%`,
                        top: `${media.overlay_y ?? 50}%`,
                        width: `${media.overlay_width ?? 80}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="relative transition-all duration-200">
                        <div
                          className="absolute inset-0 rounded-xl bg-black/35 blur-md"
                          style={{ margin: '-6px' }}
                        />
                        <p
                          className="relative break-words px-4 py-2 font-bold"
                          style={{
                            color: media.overlay_color || '#FFFFFF',
                            fontSize: `${media.overlay_font_size ?? 32}px`,
                            textAlign: media.overlay_align || 'center',
                            lineHeight: 1.1,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                          }}
                        >
                          {media.overlay_text}
                        </p>
                      </div>
                    </div>
                  )}

                  {hasMultipleMedia && (
                    <>
                      {currentIndex > 0 && (
                        <button
                          onClick={() => handleSwipe('right')}
                          className="absolute bottom-0 left-0 top-0 z-30 w-1/3 cursor-pointer"
                          aria-label="Previous media"
                        />
                      )}
                      {currentIndex < post.media.length - 1 && (
                        <button
                          onClick={() => handleSwipe('left')}
                          className="absolute bottom-0 right-0 top-0 z-30 w-1/3 cursor-pointer"
                          aria-label="Next media"
                        />
                      )}

                      {/* Swipe hint arrow — visible until user swipes */}
                      {!swipedPosts.has(post.id) && currentIndex === 0 && (
                        <div className="pointer-events-none absolute right-3 z-50"
                          style={{ bottom: 'calc(6rem + 48px)' }}
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 animate-[swipeHint_1.5s_ease-in-out_infinite]">
                            <ChevronRight className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {debugMode && (
                    <div className="pointer-events-none absolute left-4 top-4 z-40 rounded bg-red-600 px-2 py-1 text-xs font-mono text-white shadow-lg">
                      <div className="flex flex-col gap-0.5">
                        <div>status: {post.status || 'N/A'}</div>
                        <div>spam: {post.spam_score ?? 'N/A'}</div>
                        <div>penalty: {post.rank_penalty ?? 'N/A'}</div>
                        <div>phones: {post.phone_count ?? 0}</div>
                        <div>links: {post.link_count ?? 0}</div>
                        <div>hashtags: {post.hashtag_count ?? 0}</div>
                      </div>
                    </div>
                  )}

                  {hasMultipleMedia && (
                    <div className="pointer-events-none absolute left-0 right-0 z-40 flex justify-center gap-1.5"
                      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 58px)' }}
                    >
                      {post.media.map((_, index) => (
                        <div
                          key={index}
                          className={`h-[3px] rounded-full shadow-md transition-all duration-300 ${
                            index === currentIndex
                              ? 'w-6 bg-white'
                              : index < currentIndex
                              ? 'w-3 bg-white/80'
                              : 'w-3 bg-white/35'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {postIndex === 0 && showSwipeHint && (
                    <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center animate-bounce">
                      <ChevronRight className="h-10 w-10 rotate-[-90deg] text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
                    </div>
                  )}

                  <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(post);
                      }}
                      className="group flex flex-col items-center gap-1"
                    >
                      <Heart
                        className={`h-7 w-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-all ${
                          post.user_has_reacted
                            ? 'scale-110 fill-red-500 text-red-500'
                            : 'text-white group-hover:scale-110'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {post.reactions_count}
                      </span>
                    </button>

                    <button
                      onClick={() => openComments(post)}
                      className="group flex flex-col items-center gap-1"
                    >
                      <MessageCircle className="h-7 w-7 text-white transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110" />
                      <span className="text-xs font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {post.comments_count}
                      </span>
                    </button>

                    <div className="flex flex-col items-center gap-1 opacity-70">
                      <Eye className="h-6 w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                      <span className="text-xs font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {post.views_count}
                      </span>
                    </div>

                    <button
                      onClick={() => handleShare(post)}
                      className="group flex flex-col items-center gap-1"
                    >
                      <Share2 className="h-7 w-7 text-white transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110" />
                    </button>

                    <button
                      onClick={(e) => handleSave(e, post.id)}
                      className="group flex flex-col items-center gap-1"
                    >
                      <Bookmark
                        className={`h-7 w-7 transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110 ${
                          savedSet.has(post.id)
                            ? 'fill-white text-white scale-110'
                            : 'text-white'
                        }`}
                      />
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="group flex flex-col items-center gap-1">
                          <MoreVertical className="h-7 w-7 text-white transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-gray-800 bg-gray-900">
                        {user?.id === post.user_id ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleEdit(post)}
                              className="cursor-pointer text-white hover:bg-gray-800"
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              {t('posts.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(post.id)}
                              className="cursor-pointer text-red-400 hover:bg-gray-800"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('posts.delete')}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setReportTarget({ type: 'post', id: post.id, userId: post.user_id });
                                setReportModalOpen(true);
                              }}
                              className="cursor-pointer text-white hover:bg-gray-800"
                            >
                              <Flag className="mr-2 h-4 w-4" />
                              {t('report.reportPost')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setReportTarget({ type: 'profile', id: post.user_id, userId: post.user_id });
                                setReportModalOpen(true);
                              }}
                              className="cursor-pointer text-white hover:bg-gray-800"
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              {t('report.reportUser')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {isVideo && (
                      <button
                        onClick={(e) => toggleMute(e)}
                        className="group flex flex-col items-center gap-1"
                      >
                        {!isGlobalMuted ? (
                          <Volume2 className="h-7 w-7 text-white transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110" />
                        ) : (
                          <VolumeX className="h-7 w-7 text-white transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-110" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Bottom info: user + text + comment input */}
                  <div
                    className="absolute bottom-3 left-3 right-16 flex flex-col gap-2 text-white"
                    style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none' }}
                  >
                    {/* User row */}
                    <div className="flex items-center gap-2">
                      {/* Avatar + name + follow */}
                      <div
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/profile/${post.user_id}`);
                        }}
                      >
                        <Avatar className="h-8 w-8 flex-shrink-0 border border-white/30">
                          <AvatarImage src={post.user?.avatar_url} alt={post.user?.name} />
                          <AvatarFallback className="bg-black text-xs font-semibold text-white">
                            {post.user?.name?.charAt(0).toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {post.user.name}
                          </p>
                          {post.user.account_type === 'professional' && (
                            <ProfessionalBadge size="sm" />
                          )}
                          {user && post.user_id !== user.id && (
                            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <FollowButton
                                targetUserId={post.user_id}
                                currentUserId={user.id}
                                size="sm"
                                isFollowing={followedUserIds.has(post.user_id)}
                                onFollowChange={(following) => {
                                  setFollowedUserIds(prev => {
                                    const next = new Set(prev);
                                    if (following) next.add(post.user_id);
                                    else next.delete(post.user_id);
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rating + Contact button for professionals */}
                    {post.user.account_type === 'professional' && (
                      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {post.user.average_rating && post.user.average_rating > 0 && (
                          <div className="flex items-center gap-1.5 text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            <Star className="h-3.5 w-3.5 flex-shrink-0 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold">{post.user.average_rating.toFixed(1)}</span>
                            <span className="text-white/80">·</span>
                            <span className="text-white/90">
                              {post.user.review_count && post.user.review_count > 0
                                ? `${post.user.review_count} recenzija`
                                : '0 recenzija'}
                            </span>
                          </div>
                        )}
                        {user && post.user_id !== user.id && (
                          <button
                            onClick={() => handleContact(post.user_id)}
                            disabled={contactingUserId === post.user_id}
                            className="flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-0.5 text-xs font-semibold text-white shadow-md backdrop-blur-sm hover:bg-orange-500 transition-colors disabled:opacity-60"
                          >
                            {contactingUserId === post.user_id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <MessageCircle className="h-3 w-3" />
                            }
                            Kontaktiraj
                          </button>
                        )}
                      </div>
                    )}

                    {/* Caption */}
                    {post.text && (() => {
                      const isLong = post.text.length > TEXT_MAX_LENGTH;
                      const isExpanded = expandedText[post.id];
                      return (
                        <div className="max-w-[90%]">
                          <div className="rounded-2xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-sm">
                            <p
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isLong) setExpandedText((prev) => ({ ...prev, [post.id]: !prev[post.id] }));
                              }}
                              className={`whitespace-pre-line text-[14px] leading-snug text-white drop-shadow-md transition-all duration-200 ${isLong && !isExpanded ? 'line-clamp-2' : ''}`}
                            >
                              {post.text}
                            </p>
                            {isLong && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedText((prev) => ({ ...prev, [post.id]: !prev[post.id] }));
                                }}
                                className="mt-1 text-xs font-bold text-orange-400 transition-colors hover:text-orange-300"
                              >
                                {isExpanded ? t('posts.showLess') : t('posts.readMore')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Hashtags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        {post.hashtags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => setActiveHashtag(activeHashtag === tag ? null : tag)}
                            className={`text-xs font-semibold transition-colors ${
                              activeHashtag === tag
                                ? 'text-orange-400'
                                : 'text-white/70 hover:text-white'
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="-mx-3 -mb-1 h-[3px] w-[calc(100%+68px)] overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-100"
                        style={{
                          width: `${
                            isVideo
                              ? (videoProgress[`${post.id}-${currentIndex}`] || 0)
                              : (imageProgress[`${post.id}-${currentIndex}`] || 0)
                          }%`
                        }}
                      />
                    </div>

                    {/* Inline comment input */}
                    <div
                      className="flex items-center gap-2 -mr-14"
                      onClick={(e) => e.stopPropagation()}
                      data-no-playpause
                    >
                      <div className="flex flex-1 items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 backdrop-blur-sm">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInlineComment(post.id);
                            }
                          }}
                          placeholder={t('posts.addComment')}
                          className="flex-1 bg-transparent text-sm text-white placeholder-white/45 outline-none"
                        />
                        <button
                          onClick={() => handleInlineComment(post.id)}
                          disabled={submittingComment[post.id] || !(commentInputs[post.id] || '').trim()}
                          className="flex-shrink-0 text-white/60 transition-colors hover:text-white disabled:opacity-30"
                        >
                          {submittingComment[post.id]
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Send className="h-4 w-4" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!emptyState && hasMore && (
          <div
            ref={loaderRef}
            className="flex h-[100svh] w-screen snap-start items-center justify-center bg-black"
          >
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {!emptyState && !hasMore && posts.length > 0 && (
          <div className="flex h-[100svh] w-screen snap-start items-center justify-center bg-black">
            <div className="text-center">
              <p className="mb-2 text-lg text-white/60">Stigli ste do kraja</p>
              <p className="text-sm text-white/40">Nema više postova</p>
            </div>
          </div>
        )}

        {selectedPost && (
          <CommentsSheet
            open={commentsOpen}
            onOpenChange={setCommentsOpen}
            postId={selectedPost.id}
            commentsCount={selectedPost.comments_count}
            onCommentAdded={handleCommentAdded}
          />
        )}

        <CreatePostModal
          open={createPostOpen}
          onOpenChange={setCreatePostOpen}
          onSuccess={handlePostCreated}
        />

        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogContent className="border-gray-800 bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-white">Meni</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-800"
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/settings');
                }}
              >
                Podešavanja
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-800"
                onClick={() => {
                  setMenuOpen(false);
                  toast.info('Kontakt podrška uskoro!');
                }}
              >
                Prijavi problem
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-800"
                onClick={() => {
                  setMenuOpen(false);
                  toast.info('O aplikaciji uskoro!');
                }}
              >
                O aplikaciji
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {reportTarget && (
          <ReportModal
            open={reportModalOpen}
            onOpenChange={setReportModalOpen}
            targetType={reportTarget.type}
            targetId={reportTarget.id}
            targetOwnerUserId={reportTarget.userId}
          />
        )}

        {shareModalPostId && (
          <SharePostModal
            postId={shareModalPostId}
            open={!!shareModalPostId}
            onOpenChange={(open) => { if (!open) setShareModalPostId(null); }}
          />
        )}

        {postToEdit && (
          <EditPostModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            postId={postToEdit.id}
            postType={undefined}
            initialText={postToEdit.text}
            media={postToEdit.media}
            onSave={async () => {
              await loadPosts(true);
              setEditModalOpen(false);
            }}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('posts.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('posts.deleteConfirmDescription')}
              </AlertDialogDescription>
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

    </>
  );
}

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedContent />
    </ProtectedRoute>
  );
}
