'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical, MapPin, Briefcase, DollarSign, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';
import { useLanguage } from '@/lib/contexts/language-context';

type PostMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  order: number;
};

type ServiceListingCardProps = {
  post: {
    id: string;
    user_id: string;
    text: string | null;
    created_at: string;
    post_type: string;
    category?: string | null;
    city?: string | null;
    country?: string | null;
    job_title?: string | null;
    price_type?: string | null;
    price_value?: number | null;
    currency?: string | null;
    status?: string;
    spam_score?: number;
    rank_penalty?: number;
    link_count?: number;
    phone_count?: number;
    hashtag_count?: number;
    media?: PostMedia[];
  };
  currentUserId?: string;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  showActions?: boolean;
};

export function ServiceListingCard({
  post,
  currentUserId,
  onEdit,
  onDelete,
  showActions = true
}: ServiceListingCardProps) {
  const { t } = useLanguage();
  const isOwner = currentUserId === post.user_id;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = post.media || [];

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prev = useCallback(() => setLightboxIndex(i => i !== null ? (i - 1 + images.length) % images.length : null), [images.length]);
  const next = useCallback(() => setLightboxIndex(i => i !== null ? (i + 1) % images.length : null), [images.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, prev, next]);

  const formatPrice = () => {
    if (!post.price_value) return null;

    const currency = post.currency || 'RSD';
    const priceType = post.price_type || 'fixed';

    let priceLabel = '';
    if (priceType === 'fixed') {
      priceLabel = 'Fiksno';
    } else if (priceType === 'hourly') {
      priceLabel = 'Po satu';
    } else if (priceType === 'negotiable') {
      priceLabel = 'Dogovor';
    }

    return `${post.price_value.toLocaleString()} ${currency}${priceType !== 'fixed' ? ` (${priceLabel})` : ''}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                  {t('marketplace.serviceListing')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(post.created_at)}
                </span>
              </div>

              {post.job_title && (
                <h3 className="font-semibold text-base mb-2 break-words line-clamp-2">{post.job_title}</h3>
              )}

              {post.text && (
                <p className="text-sm leading-relaxed text-muted-foreground mb-3 break-words">
                  {post.text}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs">
                {post.category && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{post.category}</span>
                  </div>
                )}
                {(post.city || post.country) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{[post.city, post.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {formatPrice() && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-medium">{formatPrice()}</span>
                  </div>
                )}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((media: PostMedia, index: number) => (
                    <div
                      key={media.id}
                      className="relative aspect-[4/3] rounded overflow-hidden bg-slate-100 cursor-pointer group"
                      onClick={() => openLightbox(index)}
                    >
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt="Service media"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <video
                          src={media.url}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Lightbox */}
              {lightboxIndex !== null && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                  onClick={closeLightbox}
                >
                  <button
                    className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/60 transition"
                    onClick={closeLightbox}
                  >
                    <X className="h-6 w-6" />
                  </button>

                  {images.length > 1 && (
                    <>
                      <button
                        className="absolute left-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/60 transition"
                        onClick={e => { e.stopPropagation(); prev(); }}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        className="absolute right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/60 transition"
                        onClick={e => { e.stopPropagation(); next(); }}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  <div className="w-full max-w-5xl max-h-[90vh] px-10 sm:px-16" onClick={e => e.stopPropagation()}>
                    {images[lightboxIndex].type === 'image' ? (
                      <img
                        src={images[lightboxIndex].url}
                        alt="Service media"
                        className="w-full max-h-[85vh] object-contain rounded-lg"
                      />
                    ) : (
                      <video
                        src={images[lightboxIndex].url}
                        controls
                        autoPlay
                        className="w-full max-h-[85vh] rounded-lg"
                      />
                    )}
                    {images.length > 1 && (
                      <p className="text-center text-white/60 text-sm mt-3">
                        {lightboxIndex + 1} / {images.length}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {showActions && isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(post.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('posts.edit')}
                    </DropdownMenuItem>
                  )}
                  {onEdit && onDelete && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(post.id)}
                      className="text-red-600 focus:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('posts.delete')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
