'use client';

import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProfessionalBadge } from '@/components/professional-badge';
import { MapPin, Star, Phone, Mail, Globe, Briefcase, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

type ProfileHeaderProps = {
  name: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  showPhone?: boolean;
  showEmail?: boolean;
  isOwnProfile?: boolean;
  category?: string | null;
  bio?: string | null;
  accountType: 'professional' | 'customer';
  skills?: string[] | null;
  averageRating?: number | null;
  reviewCount?: number;
  actions?: ReactNode;
  reviewAction?: ReactNode;
  verified?: boolean;
  viewerAccountType?: 'professional' | 'customer' | null;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  isLoggedIn?: boolean;
};

export function ProfileHeader({
  name,
  avatarUrl,
  city,
  phone,
  email,
  websiteUrl,
  showPhone = true,
  showEmail = false,
  isOwnProfile = false,
  category,
  bio,
  accountType,
  skills,
  averageRating,
  reviewCount,
  actions,
  reviewAction,
  postsCount,
  followersCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
  isLoggedIn = true,
}: ProfileHeaderProps) {
  const { t } = useLanguage();
  const isPro = accountType === 'professional';

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
      <div className="px-4 sm:px-6 pt-5 pb-5">

        {/* ── Avatar ── */}
        <div className="mb-3">
          <Avatar className="h-20 w-20 sm:h-28 sm:w-28 border-4 border-card shadow-xl">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={name} />
            ) : (
              <AvatarFallback
                className={`text-2xl sm:text-4xl font-bold ${
                  isPro
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700 text-white'
                }`}
              >
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        {/* ── Name + PRO badge + Follow/Message buttons on same line ── */}
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {name}
            </h1>
            {isPro && <ProfessionalBadge size="md" />}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>

        {/* ── Leave Review — below name, auto width ── */}
        {reviewAction && (
          <div className="mb-2">
            {reviewAction}
          </div>
        )}

        {/* ── Rating ── */}
        {isPro && averageRating && reviewCount && reviewCount > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${
                  s <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-200 fill-gray-200 dark:text-gray-600 dark:fill-gray-600'
                }`}
              />
            ))}
            <span className="font-semibold text-sm text-foreground ml-1">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">
              ({reviewCount} {t('profile.reviews')})
            </span>
          </div>
        )}

        {/* ── City + category ── */}
        {(city || category) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {city && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{city}</span>
              </div>
            )}
            {category && (
              <Badge
                variant="secondary"
                className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-0.5 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-0"
              >
                <Briefcase className="h-3 w-3" />
                {category === 'Other' ? t('category.Other') : category === 'Ostalo' ? t('category.Other') : category}
              </Badge>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        {(postsCount !== undefined || followersCount !== undefined || followingCount !== undefined) && (
          <div className="flex items-stretch gap-0 mb-4 rounded-xl overflow-hidden border border-border divide-x divide-border">
            {postsCount !== undefined && (
              <div className="flex-1 flex flex-col items-center py-2.5 px-2 bg-muted/40">
                <span className="text-lg font-bold text-foreground leading-none">{postsCount}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{t('profile.posts')}</span>
              </div>
            )}
            {followersCount !== undefined && (
              <button
                onClick={onFollowersClick}
                className="flex-1 flex flex-col items-center py-2.5 px-2 bg-muted/40 hover:bg-muted transition-colors"
              >
                <span className="text-lg font-bold text-foreground leading-none">{followersCount}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{t('profile.followers')}</span>
              </button>
            )}
            {followingCount !== undefined && (
              <button
                onClick={onFollowingClick}
                className="flex-1 flex flex-col items-center py-2.5 px-2 bg-muted/40 hover:bg-muted transition-colors"
              >
                <span className="text-lg font-bold text-foreground leading-none">{followingCount}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">{t('profile.following')}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Bio ── */}
        {bio && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{bio}</p>
        )}

        {/* ── Skills ── */}
        {isPro && skills && skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {skills.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs rounded-full px-2.5 py-0.5">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* ── Contact info ── */}
        {!isLoggedIn && !isOwnProfile && ((phone && showPhone) || (email && showEmail)) ? (
          <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>{t('profile.signInToViewContact')}</span>
          </div>
        ) : (
          ((phone && (isOwnProfile || showPhone)) ||
            (email && (isOwnProfile || showEmail)) ||
            websiteUrl) && (
            <div className="flex flex-col gap-1.5 mb-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              {phone && (isOwnProfile || showPhone) && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 flex-shrink-0">
                    <Phone className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                  </span>
                  <a href={`tel:${phone}`} className="hover:text-orange-500 transition-colors text-foreground">
                    {phone}
                  </a>
                  {isOwnProfile && !showPhone && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t('profile.private')}</span>
                  )}
                </div>
              )}
              {email && (isOwnProfile || showEmail) && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 flex-shrink-0">
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </span>
                  <a href={`mailto:${email}`} className="hover:text-orange-500 transition-colors truncate text-foreground">
                    {email}
                  </a>
                  {isOwnProfile && !showEmail && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t('profile.private')}</span>
                  )}
                </div>
              )}
              {websiteUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-950 flex-shrink-0">
                    <Globe className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </span>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-500 transition-colors truncate text-foreground"
                  >
                    {websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
