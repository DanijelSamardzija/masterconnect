'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical, MapPin, Briefcase, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                  {t('marketplace.serviceListing')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>

              {post.job_title && (
                <h3 className="font-semibold text-base mb-2">{post.job_title}</h3>
              )}

              {post.text && (
                <p className="text-sm leading-relaxed text-muted-foreground mb-3">
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
                {post.city && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{post.city}</span>
                  </div>
                )}
                {formatPrice() && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-medium">{formatPrice()}</span>
                  </div>
                )}
              </div>

              {post.media && post.media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {post.media.map((media: PostMedia) => (
                    <div key={media.id} className="relative aspect-[4/3] rounded overflow-hidden bg-slate-100">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt="Service media"
                          className="w-full h-full object-cover"
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
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onEdit && onDelete && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(post.id)}
                      className="text-red-600 focus:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
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
