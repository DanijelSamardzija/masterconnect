'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Pin, Pencil, Trash2, MapPin, Star, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ProfessionalBadge } from '@/components/professional-badge';
import { PostReactions } from '@/components/post-reactions';
import { PostCommentsButton } from '@/components/post-comments-button';
import { ReviewsModal } from '@/components/reviews-modal';
import { APP_CATEGORIES } from '@/lib/constants';
import { useLanguage } from '@/lib/contexts/language-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import { toast } from 'sonner';

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
  name: string;
  email?: string;
  account_type: 'professional' | 'customer';
  avatar_url?: string;
  average_rating?: number;
  review_count?: number;
  is_premium?: boolean;
};

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  is_pinned?: boolean;
  pinned_at?: string | null;
  category?: string | null;
  category_normalized?: string | null;
  city?: string | null;
  job_title?: string | null;
  price_type?: string | null;
  price_value?: number | null;
  post_type?: string;
  comments_count?: number;
  user?: PostUser;
  media: PostMedia[];
  spam_score?: number;
  rank_penalty?: number;
  link_count?: number;
  phone_count?: number;
  status?: string;
};

interface LegacyPostCardProps {
  post: Post;
  currentUserId?: string;
  currentUserAccountType?: 'professional' | 'customer';
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onPin?: (postId: string, currentPinStatus: boolean) => void;
  showPinOption?: boolean;
}

export function LegacyPostCard({
  post,
  currentUserId,
  currentUserAccountType,
  onDelete,
  onEdit,
  onPin,
  showPinOption = false
}: LegacyPostCardProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const isOwnPost = currentUserId === post.user_id;
  const showMenu = isOwnPost && (onDelete || onEdit || onPin);

  const handleDelete = () => {
    onDelete?.(post.id);
  };

  const handleEdit = () => {
    onEdit?.(post.id);
  };

  const handlePin = () => {
    onPin?.(post.id, post.is_pinned || false);
  };

  const handleUserClick = () => {
    router.push(`/profile/${post.user_id}`);
  };

  const handleSendMessage = async () => {
    if (!currentUserId || !post.user_id) {
      toast.error('Unable to send message');
      return;
    }

    setSendingMessage(true);
    try {
      const result = await findOrCreateThread({
        customerId: currentUserAccountType === 'customer' ? currentUserId : post.user_id,
        proId: currentUserAccountType === 'professional' ? currentUserId : post.user_id
      });

      if (result.threadId) {
        router.push(`/messages/${result.threadId}`);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to create conversation');
    } finally {
      setSendingMessage(false);
    }
  };

  const getTextSizeClass = (size?: 'small' | 'medium' | 'large' | null) => {
    switch (size) {
      case 'small':
        return 'text-lg sm:text-xl';
      case 'medium':
        return 'text-2xl sm:text-3xl';
      case 'large':
        return 'text-3xl sm:text-5xl';
      default:
        return 'text-2xl sm:text-3xl';
    }
  };

  const getColorValue = (color?: string | null) => {
    const colorMap: Record<string, string> = {
      'white': '#FFFFFF',
      'black': '#000000',
      'red': '#EF4444',
      'blue': '#3B82F6',
      'yellow': '#FACC15',
      'green': '#10B981',
      'purple': '#A855F7',
      'pink': '#EC4899',
    };
    return colorMap[color || 'white'] || color || '#FFFFFF';
  };

  return (
    <Card className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow flex flex-col h-full">
      {post.media && post.media.length > 0 ? (
        <div className={`relative w-full overflow-hidden rounded-t-lg bg-black ${
          post.media[0].type === 'image'
            ? 'aspect-[9/16] lg:aspect-auto lg:max-w-[90vw] lg:max-h-[90vh] lg:flex lg:items-center lg:justify-center lg:outline lg:outline-4 lg:outline-red-500'
            : 'aspect-[9/16] lg:w-[520px] lg:flex lg:items-center lg:justify-center'
        }`}>
          {post.media[0].type === 'image' && (
            <div className="hidden lg:block absolute top-2 left-2 z-50 bg-red-500 text-white px-2 py-1 text-xs font-bold">
              DESKTOP IMAGE MODE
            </div>
          )}
          {post.media[0].type === 'image' ? (
            <>
              {/* Mobile image - cover style */}
              <img
                src={post.media[0].url}
                alt="Post media"
                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
              />
              {/* Desktop image - fit/contain style */}
            </>
          ) : (
            <video
              src={post.media[0].url}
              controls
              playsInline
              loop
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {post.media[0].overlay_text && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${post.media[0].overlay_x ?? 50}%`,
                top: `${post.media[0].overlay_y ?? 50}%`,
                width: `${post.media[0].overlay_width ?? 80}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative">
                <div
                  className="absolute inset-0 bg-black/40 blur-md"
                  style={{ margin: '-8px' }}
                />
                <p
                  className="relative font-bold px-4 py-1 break-words leading-tight"
                  style={{
                    color: getColorValue(post.media[0].overlay_color),
                    fontSize: `${post.media[0].overlay_font_size ?? 32}px`,
                    textAlign: post.media[0].overlay_align ?? 'center',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {post.media[0].overlay_text}
                </p>
              </div>
            </div>
          )}
          <div className="absolute top-2 left-2 right-2 md:top-2 md:left-2 md:right-2 flex items-start justify-between">
            <div className="flex items-center gap-1.5 md:gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 md:px-2.5 md:py-1">
              <Avatar className="h-6 w-6 md:h-6 md:w-6 ring-2 ring-white">
                {post.user?.avatar_url ? (
                  <AvatarImage src={post.user.avatar_url} alt={post.user.name} />
                ) : (
                  <AvatarFallback className="bg-orange-600 text-white text-xs">
                    {post.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col gap-0">
                <div className="flex items-center gap-1">
                  <p
                    className="font-semibold text-white text-xs md:text-xs cursor-pointer hover:underline"
                    onClick={handleUserClick}
                  >
                    {post.user?.name || 'Unknown User'}
                  </p>
                  {post.user?.account_type === 'professional' && (
                    post.user?.is_premium
                      ? <ProfessionalBadge size="sm" variant="premium" />
                      : <ProfessionalBadge size="sm" />
                  )}
                </div>
                {post.user?.account_type === 'professional' &&
                 post.user?.review_count &&
                 post.user.review_count > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReviewsModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full hover:bg-black/60 transition-all hover:scale-105 active:scale-95"
                  >
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-white text-sm font-bold">
                      {post.user.average_rating?.toFixed(1) || '0.0'}
                    </span>
                    <span className="text-white/90 text-xs font-medium">
                      ({post.user.review_count})
                    </span>
                  </button>
                )}
              </div>
            </div>
            {showMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 md:h-6 md:w-6 p-0 bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white">
                    <MoreVertical className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {showPinOption && onPin && (
                    <>
                      <DropdownMenuItem onClick={handlePin}>
                        <Pin className="h-4 w-4 mr-2" />
                        {post.is_pinned ? 'Unpin post' : 'Pin post'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit post
                    </DropdownMenuItem>
                  )}
                  {onEdit && onDelete && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {showPinOption && post.is_pinned && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2">
              <Badge variant="secondary" className="text-xs gap-0.5 bg-orange-600/90 backdrop-blur-sm text-white border-0 px-1.5 py-0.5">
                <Pin className="h-2.5 w-2.5" />
                Pinned
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <CardHeader className="pb-2 md:pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-1.5">
              <Avatar className="h-8 w-8 md:h-7 md:w-7">
                {post.user?.avatar_url ? (
                  <AvatarImage src={post.user.avatar_url} alt={post.user.name} />
                ) : (
                  <AvatarFallback className="bg-orange-600 text-white text-xs md:text-xs">
                    {post.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5 md:gap-1">
                  <p
                    className="font-semibold text-slate-800 dark:text-white text-sm md:text-xs cursor-pointer hover:underline"
                    onClick={handleUserClick}
                  >
                    {post.user?.name || 'Unknown User'}
                  </p>
                  {post.user?.account_type === 'professional' && (
                    post.user?.is_premium
                      ? <ProfessionalBadge size="sm" variant="premium" />
                      : <ProfessionalBadge size="sm" />
                  )}
                  {post.user?.account_type === 'professional' &&
                   post.user?.average_rating &&
                   post.user?.review_count &&
                   post.user.review_count > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-slate-700 dark:text-gray-300 text-xs font-medium">
                        {post.user.average_rating.toFixed(1)} ({post.user.review_count})
                      </span>
                    </div>
                  )}
                  {showPinOption && post.is_pinned && (
                    <Badge variant="secondary" className="text-xs gap-0.5 px-1.5 py-0.5">
                      <Pin className="h-2.5 w-2.5" />
                      Pinned
                    </Badge>
                  )}
                </div>
                <p className="text-xs md:text-[10px] text-slate-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {showMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 md:h-6 md:w-6 p-0">
                    <MoreVertical className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {showPinOption && onPin && (
                    <>
                      <DropdownMenuItem onClick={handlePin}>
                        <Pin className="h-4 w-4 mr-2" />
                        {post.is_pinned ? 'Unpin post' : 'Pin post'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit post
                    </DropdownMenuItem>
                  )}
                  {onEdit && onDelete && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-2 md:space-y-2 pt-3 pb-3 flex flex-col flex-grow">
        {!post.media?.length && (
          <p className="text-xs text-slate-500 dark:text-gray-400 -mt-3 mb-1">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        )}

        {post.job_title && (
          <h3 className="text-lg md:text-base font-bold text-slate-900 dark:text-gray-100 line-clamp-2">
            {post.job_title}
          </h3>
        )}

        {(post.category || post.city) && (
          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-gray-300">
            {post.category && (() => {
              const catData = APP_CATEGORIES.find(c => c.slug === post.category);
              const label = catData ? t(`category.${catData.slug}`) : post.category;
              return <span className="font-medium capitalize">{label}</span>;
            })()}
            {post.category && post.city && <span>•</span>}
            {post.city && (
              <span>{post.city}</span>
            )}
          </div>
        )}

        {post.text && (
          <p className="text-slate-500 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed line-clamp-3 md:line-clamp-2 flex-grow-0">
            {post.text}
          </p>
        )}

        {(post.price_type && post.price_value) && (
          <div className="text-sm font-semibold text-orange-600">
            {post.price_value} RSD
            {post.price_type === 'hourly' && ' /sat'}
            {post.price_type === 'daily' && ' /dan'}
            {post.price_type === 'fixed' && ' - fiksna cena'}
          </div>
        )}

        {post.post_type === 'service_listing' &&
         !isOwnPost &&
         currentUserAccountType === 'customer' &&
         post.user?.account_type === 'professional' && (
          <Button
            onClick={handleSendMessage}
            disabled={sendingMessage}
            className="w-full gap-2"
            size="sm"
          >
            <MessageCircle className="h-4 w-4" />
            {sendingMessage ? 'Connecting...' : 'Send Message'}
          </Button>
        )}

        <div className="mt-auto space-y-2">
          <PostReactions postId={post.id} />
          <PostCommentsButton postId={post.id} commentsCount={post.comments_count || 0} />
        </div>
      </CardContent>

      {post.user?.account_type === 'professional' &&
       post.user?.review_count &&
       post.user.review_count > 0 && (
        <ReviewsModal
          open={showReviewsModal}
          onOpenChange={setShowReviewsModal}
          proId={post.user_id}
          proName={post.user.name}
          averageRating={post.user.average_rating}
          reviewCount={post.user.review_count}
        />
      )}
    </Card>
  );
}
