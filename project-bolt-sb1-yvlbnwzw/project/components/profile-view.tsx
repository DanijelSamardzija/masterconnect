'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { ProfileHeader } from '@/components/profile-header';
import { ServiceListingCard } from '@/components/service-listing-card';
import { EditPostModal } from '@/components/edit-post-modal';
import { CreateMarketplacePostModal } from '@/components/create-marketplace-post-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  MoreVertical,
  Plus,
  FileText,
  StarIcon,
  Trash2,
  Briefcase,
  Heart,
  MessageCircle,
  Star,
  Bookmark,
  Eye,
  Crown,
  Coins,
  Copy,
  Check,
  Users,
  Info,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Zap,
  Loader2,
  Wrench,
  Search,
  UserCircle,
  CreditCard,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { CommentsSheet } from '@/components/comments-sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FollowButton } from '@/components/follow-button';
import { FollowListSheet } from '@/components/follow-list-sheet';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const BoostModal = dynamic(
  () => import('@/components/boost-modal').then(m => ({ default: m.BoostModal })),
  { ssr: false }
);
const SupportModal = dynamic(
  () => import('@/components/support-modal').then(m => ({ default: m.SupportModal })),
  { ssr: false }
);

type PostMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  order: number;
};

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  is_pinned?: boolean;
  pinned_at?: string | null;
  post_type?: string;
  profession?: string;
  experience_level?: string;
  location?: string;
  availability?: string;
  category?: string;
  city?: string;
  is_active?: boolean;
  job_title?: string;
  price_type?: string;
  price_value?: number;
  currency?: string;
  status?: string;
  spam_score?: number;
  rank_penalty?: number;
  link_count?: number;
  phone_count?: number;
  hashtag_count?: number;
  promoted_until?: string | null;
  media: PostMedia[];
  reactions_count?: number;
  comments_count?: number;
  views_count?: number;
  user_has_reacted?: boolean;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    avatar_url?: string;
  } | null;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  account_type: 'professional' | 'customer';
  city?: string;
  country?: string;
  category?: string;
  bio?: string;
  skills?: string[];
  phone?: string;
  avatar_url?: string;
  average_rating?: number;
  review_count?: number;
  website_url?: string;
  show_phone?: boolean;
  show_email?: boolean;
  is_premium?: boolean;
};

type ProfileViewProps = {
  profile: UserProfile;
  currentUserId?: string;
  isOwnProfile: boolean;
  isLoggedIn?: boolean;
  onSendMessage?: () => void;
  headerActions?: React.ReactNode;
  callAction?: React.ReactNode;
  reviewAction?: React.ReactNode;
};



function CreditsWidget({ profile, t }: { profile: UserProfile; t: (k: string) => string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const isCreatorPremium = (profile as any).is_premium === true;
  const referralCode = (profile as any).referral_code;
  const referralUrl = referralCode ? `${typeof window !== 'undefined' ? window.location.origin : 'https://gigzone.app'}/join?ref=${referralCode}` : '';

  useEffect(() => {
    if (!profile.id) return;
    supabase.from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_id', profile.id)
      .then(({ count }) => setReferralCount(count ?? 0));
  }, [profile.id]);

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    supabase
      .from('credits_balance')
      .select('balance')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setBalance(data?.balance ?? 0);
        setLoading(false);
      });
  }, [profile.id]);

  const handleUpgrade = async () => {
    if (upgrading || isCreatorPremium) return;
    setUpgrading(true);
    try {
      const { data } = await supabase.rpc('become_creator_premium', { p_user_id: profile.id });
      if (data?.ok) {
        setBalance(prev => (prev !== null ? prev - 500 : prev));
        toast.success(t('credits.creatorPremium.activated') + ' ' + t('credits.creatorPremium.reloadNote'));
        setTimeout(() => window.location.reload(), 2500);
      } else if (data?.error === 'insufficient_balance') {
        toast.error(t('credits.creatorPremium.insufficient').replace('{balance}', String(data.balance ?? data.have ?? 0)));
      } else if (data?.error === 'already_creator_premium') {
        toast.info(t('credits.creatorPremium.alreadyPremium'));
      } else {
        toast.error(t('credits.creatorPremium.error'));
      }
    } catch {
      toast.error(t('credits.creatorPremium.error'));
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <>
      <div className="mt-3 rounded-xl border border-orange-300/30 bg-gradient-to-r from-orange-500/8 to-amber-500/5 overflow-hidden">
        {/* Balance row — clickable to open info */}
        <button
          onClick={() => setInfoOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-500/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">{t('credits.balance.title')}</p>
              <p className="text-[11px] text-muted-foreground">{t('credits.info.howToEarnSpend')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-orange-500">
              {loading ? '—' : balance ?? 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">{t('credits.unit')}</span>
            </span>
            <Info className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          </div>
        </button>

        {/* Buy credits row */}
        <div className="border-t border-orange-300/20 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">{t('credits.buy.button')}</p>
              <p className="text-[11px] text-muted-foreground">{t('credits.buy.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setBuyCreditsOpen(true)}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            {t('credits.buy.button')}
          </button>
        </div>

        {/* Referral row */}
        <div className="border-t border-orange-300/20 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">{t('referral.title')}</p>
              <p className="text-[11px] text-muted-foreground">
                {t('referral.subtitle').replace('{count}', String(referralCount ?? '—'))}
              </p>
            </div>
          </div>
          {referralCode && (
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors min-w-[82px]"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('referral.copied') : t('referral.copy')}
            </button>
          )}
        </div>

        {/* PRO Premium upgrade CTA */}
        {!isCreatorPremium && (
          <div className="border-t border-orange-300/20 px-4 py-3">
            <p className="text-xs font-semibold text-foreground mb-2">🔶 PRO Premium</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {(['verifiedBadge', 'receiveSupport', 'moreTrust', 'analytics', 'futureBenefits'] as const).map((key) => (
                <span key={key} className="inline-flex items-center gap-0.5 text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-300 rounded-full px-2 py-0.5">
                  <Check className="h-2.5 w-2.5 shrink-0" />
                  {t(`credits.creatorPremium.benefits.${key}`)}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">500 {t('credits.unit')}</p>
                <p className="text-[10px] text-orange-500 font-medium">{t('credits.creatorPremium.oneTime')}</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading || (balance !== null && balance < 500)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white disabled:opacity-40 hover:from-orange-600 hover:to-amber-600 transition-all shrink-0"
              >
                {upgrading ? '...' : t('credits.creatorPremium.activate')}
              </button>
            </div>
          </div>
        )}

        {isCreatorPremium && (
          <div className="border-t border-orange-300/20 px-4 py-2 flex items-center gap-2">
            <span className="text-xs">🧡</span>
            <p className="text-[11px] text-muted-foreground">{t('credits.creatorPremium.canReceive')}</p>
          </div>
        )}
      </div>

      {/* Buy Credits modal */}
      <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-orange-500" />
              {t('credits.buy.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-1">
            {([
              { credits: 250, eur: 5,  bonus: null },
              { credits: 550, eur: 10, bonus: 50 },
              { credits: 1200, eur: 20, bonus: 200, popular: true },
              { credits: 3200, eur: 50, bonus: 700 },
            ] as { credits: number; eur: number; bonus: number | null; popular?: boolean }[]).map((pkg) => (
              <div
                key={pkg.eur}
                className={`relative rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
                  pkg.popular
                    ? 'border-orange-400 bg-orange-500/8'
                    : 'border-border bg-muted/30'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 left-3 text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                    {t('credits.buy.popular')}
                  </span>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {pkg.credits.toLocaleString()} {t('credits.unit')}
                    {pkg.bonus && (
                      <span className="ml-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                        +{pkg.bonus} {t('credits.buy.bonus')}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`text-base font-bold shrink-0 ${pkg.popular ? 'text-orange-500' : 'text-foreground'}`}>
                  {pkg.eur} €
                </span>
              </div>
            ))}
          </div>

          {/* Stripe not available notice */}
          <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              {t('credits.buy.stripeNotice')}
            </p>
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setBuyCreditsOpen(false)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              {t('credits.buy.close')}
            </button>
            <a
              href="/contact"
              onClick={() => setBuyCreditsOpen(false)}
              className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2.5 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold">{t('credits.buy.contactSupport')}</span>
                <span className="text-[10px] opacity-80">{t('credits.buy.contactSupportSub')}</span>
              </span>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits info modal */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Coins className="h-5 w-5 text-orange-500" />
              GigZone Krediti
            </DialogTitle>
          </DialogHeader>

          {/* Earn section */}
          <div className="mt-1">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-sm font-semibold text-foreground">{t('credits.info.earn.title')}</p>
            </div>
            <div className="space-y-1.5">
              {([
                { key: 'registration', amount: '+5' },
                { key: 'profile', amount: '+5' },
                { key: 'firstPost', amount: '+5' },
                { key: 'firstService', amount: '+5' },
                { key: 'firstJob', amount: '+5' },
                { key: 'imagePost', amount: '+2', noteKey: 'imagePostNote' },
                { key: 'videoPost', amount: '+4', noteKey: 'videoPostNote' },
                { key: 'referral', amount: '+20', noteKey: 'referralNote' },
              ] as { key: string; amount: string; noteKey?: string }[]).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg bg-green-500/8 px-3 py-1.5">
                  <div>
                    <span className="text-xs text-foreground">{t(`credits.info.earn.${item.key}` as any)}</span>
                    {item.noteKey && <span className="text-[10px] text-muted-foreground ml-1.5">({t(`credits.info.earn.${item.noteKey}` as any)})</span>}
                  </div>
                  <span className="text-xs font-bold text-green-600 dark:text-green-400">{item.amount} {t('credits.unit')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Spend section */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ShoppingBag className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-foreground">{t('credits.info.spend.title')}</p>
            </div>
            <div className="space-y-1.5">
              {([
                { key: 'boostFeed', amount: '75', noteKey: 'boostFeedNote' },
                { key: 'boostListing', amount: '140', noteKey: 'boostListingNote' },
                { key: 'creatorPremium', amount: '500', noteKey: 'creatorPremiumNote' },
                { key: 'support', amount: '1+', noteKey: 'supportNote' },
              ] as { key: string; amount: string; noteKey: string }[]).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg bg-orange-500/8 px-3 py-1.5">
                  <div>
                    <span className="text-xs text-foreground">{t(`credits.info.spend.${item.key}` as any)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({t(`credits.info.spend.${item.noteKey}` as any)})</span>
                  </div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">−{item.amount} {t('credits.unit')}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">{t('credits.info.footer')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProfileView({
  profile,
  currentUserId,
  isOwnProfile,
  isLoggedIn = true,
  onSendMessage,
  headerActions,
  callAction,
  reviewAction,
}: ProfileViewProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [marketplacePosts, setMarketplacePosts] = useState<Post[]>([]);
  const [hiringPosts, setHiringPosts] = useState<Post[]>([]);
  const [portfolioPosts, setPortfolioPosts] = useState<Post[]>([]);
  const [servicePosts, setServicePosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activity');
  const [listingFilter, setListingFilter] = useState<string>('all');
  const [postsCount, setPostsCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListOpen, setFollowListOpen] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedTab, setSavedTab] = useState<'feed' | 'services' | 'jobs'>('feed');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [createMarketplaceModalOpen, setCreateMarketplaceModalOpen] = useState(false);
  const [adTypePickerOpen, setAdTypePickerOpen] = useState(false);
  const [initialPostType, setInitialPostType] = useState<
    'service_request' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing' | undefined
  >(undefined);
  const [expandedText, setExpandedText] = useState<{ [key: string]: boolean }>({});
  const [likesDialogPostId, setLikesDialogPostId] = useState<string | null>(null);
  const [likedByUsers, setLikedByUsers] = useState<{ id: string; name: string; avatar_url?: string }[]>([]);
  const [likedByLoading, setLikedByLoading] = useState(false);
  const [commentsSheetPostId, setCommentsSheetPostId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [boostingPostId, setBoostingPostId] = useState<string | null>(null);
  const [boostModal, setBoostModal] = useState<{ postId: string; isListing: boolean; promotedUntil: string | null } | null>(null);
  const [boostBalance, setBoostBalance] = useState<number>(0);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  useEffect(() => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollLeft = 0;
    }
  }, []);

  useEffect(() => {
    if (profile) {
      fetchPosts();
      fetchMarketplacePosts();
      fetchHiringPosts();
      fetchPortfolioPosts();
      fetchServicePosts();
      fetchFollowCounts();
      if (isOwnProfile) fetchSavedPosts();
      fetchReviews();
    }
  }, [profile?.id]);

  const openLikesDialog = async (postId: string) => {
    setLikesDialogPostId(postId);
    setLikedByLoading(true);
    setLikedByUsers([]);
    const { data } = await supabase
      .from('post_reactions')
      .select('profiles!post_reactions_user_id_fkey(id, name, avatar_url)')
      .eq('post_id', postId);
    const users = (data || []).map((r: any) => r.profiles).filter(Boolean);
    setLikedByUsers(users);
    setLikedByLoading(false);
  };

  const fetchFollowCounts = async () => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('followers').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
      supabase.from('followers').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
    ]);
    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const fetchSavedPosts = async () => {
    const { data } = await supabase
      .from('saved_posts')
      .select(`
        post_id,
        posts!saved_posts_post_id_fkey (
          id, user_id, text, created_at, post_type, status,
          job_title, category, city, price_type, price_value, currency,
          profession, experience_level, availability,
          post_media ( id, type, url, order ),
          profiles!posts_user_id_fkey ( name, avatar_url )
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    const posts = (data || [])
      .map((row: any) => row.posts)
      .filter(Boolean)
      .map((p: any) => ({
        ...p,
        media: p.post_media || [],
        user: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
      }));

    setSavedPosts(posts);
  };

  const fetchPosts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          text,
          created_at,
          is_pinned,
          pinned_at,
          post_type,
          status,
          spam_score,
          rank_penalty,
          link_count,
          phone_count,
          hashtag_count,
          views_count,
          promoted_until,
          user:profiles!posts_user_id_fkey (
            name,
            email,
            account_type,
            avatar_url,
            average_rating,
            review_count
          )
        `,
          { count: 'exact' }
        )
        .eq('user_id', profile.id)
        .eq('post_type', 'social_post');

      if (!isOwnProfile) {
        query = query.eq('status', 'published');
      }

      const { data: postsData, error, count } = await query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPostsCount(count || 0);

      if (postsData) {
        const postIds = postsData.map((p: any) => p.id);

        const [mediaResult, reactionsResult, commentsResult, userReactionsResult] = await Promise.all([
          supabase
            .from('post_media')
            .select(
              'post_id, id, type, url, order, overlay_text, overlay_color, overlay_x, overlay_y, overlay_width, overlay_align, overlay_font_size'
            )
            .in('post_id', postIds)
            .order('order'),
          supabase.from('post_reactions').select('post_id').in('post_id', postIds),
          supabase.from('post_comments').select('post_id').in('post_id', postIds),
          currentUserId
            ? supabase.from('post_reactions').select('post_id').in('post_id', postIds).eq('user_id', currentUserId)
            : { data: [] as any[] },
        ]);

        const mediaByPostId = (mediaResult.data || []).reduce((acc: any, media: any) => {
          if (!acc[media.post_id]) acc[media.post_id] = [];
          acc[media.post_id].push(media);
          return acc;
        }, {});

        const reactionsCounts = (reactionsResult.data || []).reduce((acc: any, reaction: any) => {
          acc[reaction.post_id] = (acc[reaction.post_id] || 0) + 1;
          return acc;
        }, {});

        const commentsCounts = (commentsResult.data || []).reduce((acc: any, comment: any) => {
          acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
          return acc;
        }, {});

        const userReactedPosts = new Set((userReactionsResult.data || []).map((r: any) => r.post_id));

        const postsWithMedia = postsData.map((post: any) => {
          const userData = Array.isArray(post.user) ? post.user[0] : post.user;
          const media = mediaByPostId[post.id] || [];

          return {
            ...post,
            user: userData,
            media,
            reactions_count: reactionsCounts[post.id] || 0,
            comments_count: commentsCounts[post.id] || 0,
            views_count: post.views_count || 0,
            user_has_reacted: userReactedPosts.has(post.id),
          };
        });

        setPosts(postsWithMedia as Post[]);
      }
    } catch (error: any) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplacePosts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          created_at,
          post_type,
          profession,
          experience_level,
          location,
          availability,
          category,
          city,
          job_title,
          price_type,
          price_value,
          currency,
          is_active,
          status,
          spam_score,
          rank_penalty,
          link_count,
          phone_count,
          hashtag_count,
          promoted_until,
          user:profiles!posts_user_id_fkey (
            name,
            email,
            account_type,
            avatar_url
          )
        `)
        .eq('user_id', profile.id)
        .in('post_type', ['service_request', 'job_seeker_post', 'hiring_post', 'portfolio_post', 'service_listing']);

      if (!isOwnProfile) {
        query = query.eq('status', 'published');
      }

      const { data: postsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (postsData) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: mediaData } = await supabase
          .from('post_media')
          .select('*')
          .in('post_id', postIds)
          .order('order', { ascending: true });

        const postsWithMedia = postsData.map((post: any) => ({
          ...post,
          media: mediaData?.filter((m: any) => m.post_id === post.id) || [],
        }));

        setMarketplacePosts(postsWithMedia as Post[]);
      }
    } catch (error: any) {
      console.error('Error fetching marketplace posts:', error);
    }
  };

  const fetchHiringPosts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          created_at,
          post_type,
          profession,
          experience_level,
          location,
          availability,
          category,
          city,
          job_title,
          price_type,
          price_value,
          is_active,
          status,
          spam_score,
          rank_penalty,
          link_count,
          phone_count,
          hashtag_count,
          promoted_until,
          user:profiles!posts_user_id_fkey (
            name,
            email,
            account_type,
            avatar_url
          )
        `)
        .eq('user_id', profile.id)
        .eq('post_type', 'hiring_post')
        .eq('is_active', true);

      if (!isOwnProfile) {
        query = query.eq('status', 'published');
      }

      const { data: postsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (postsData) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: mediaData } = await supabase
          .from('post_media')
          .select('*')
          .in('post_id', postIds)
          .order('order', { ascending: true });

        const postsWithMedia = postsData.map((post: any) => ({
          ...post,
          media: mediaData?.filter((m: any) => m.post_id === post.id) || [],
        }));

        setHiringPosts(postsWithMedia as Post[]);
      }
    } catch (error: any) {
      console.error('Error fetching hiring posts:', error);
    }
  };

  const fetchPortfolioPosts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          created_at,
          post_type,
          profession,
          experience_level,
          location,
          availability,
          category,
          city,
          job_title,
          price_type,
          price_value,
          status,
          spam_score,
          rank_penalty,
          link_count,
          phone_count,
          hashtag_count,
          promoted_until,
          user:profiles!posts_user_id_fkey (
            name,
            email,
            account_type,
            avatar_url
          )
        `)
        .eq('user_id', profile.id)
        .eq('post_type', 'portfolio_post');

      if (!isOwnProfile) {
        query = query.eq('status', 'published');
      }

      const { data: postsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (postsData) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: mediaData } = await supabase
          .from('post_media')
          .select('*')
          .in('post_id', postIds)
          .order('order', { ascending: true });

        const postsWithMedia = postsData.map((post: any) => ({
          ...post,
          media: mediaData?.filter((m: any) => m.post_id === post.id) || [],
        }));

        setPortfolioPosts(postsWithMedia as Post[]);
      }
    } catch (error: any) {
      console.error('Error fetching portfolio posts:', error);
    }
  };

  const fetchServicePosts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          job_title,
          created_at,
          post_type,
          category,
          city,
          price_type,
          price_value,
          currency,
          status,
          spam_score,
          rank_penalty,
          link_count,
          phone_count,
          hashtag_count,
          promoted_until,
          user:profiles!posts_user_id_fkey (
            name,
            email,
            account_type,
            avatar_url
          )
        `)
        .eq('user_id', profile.id)
        .eq('post_type', 'service_listing');

      if (!isOwnProfile) {
        query = query.eq('status', 'published');
      }

      const { data: postsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (postsData) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: mediaData } = await supabase
          .from('post_media')
          .select('*')
          .in('post_id', postIds)
          .order('order', { ascending: true });

        const postsWithMedia = postsData.map((post: any) => ({
          ...post,
          media: mediaData?.filter((m: any) => m.post_id === post.id) || [],
        }));

        setServicePosts(postsWithMedia as Post[]);
      }
    } catch (error: any) {
      console.error('Error fetching service posts:', error);
    }
  };

  const fetchReviews = async () => {
    if (!profile) return;

    try {
      const { data: reviewsData, error, count } = await supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          comment,
          created_at,
          customer_id,
          profiles!reviews_customer_id_fkey (
            id,
            name,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .eq('pro_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviewsCount(count || 0);

      if (reviewsData) {
        const formattedReviews = reviewsData.map((review: any) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          created_at: review.created_at,
          customer: review.profiles
            ? {
                id: review.profiles.id,
                name: review.profiles.name,
                avatar_url: review.profiles.avatar_url,
              }
            : null,
        }));
        setReviews(formattedReviews);
      }
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUserId || !isOwnProfile) return;
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    const postId = postToDelete;
    if (!postId) return;
    setPostToDelete(null);

    try {
      const { data: mediaItems } = await supabase.from('post_media').select('url').eq('post_id', postId);

      if (mediaItems && mediaItems.length > 0) {
        const bucketName = 'post-media';
        const storagePaths = mediaItems
          .map((media: any) => {
            const bucketPath = `/storage/v1/object/public/${bucketName}/`;
            const index = media.url.indexOf(bucketPath);
            if (index === -1) return null;
            return media.url.substring(index + bucketPath.length);
          })
          .filter((path: any): path is string => path !== null);

        if (storagePaths.length > 0) {
          await supabase.storage.from(bucketName).remove(storagePaths);
        }
      }

      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', profile.id);

      if (error) {
        console.error('Error deleting post:', error);
        toast.error('Failed to delete post');
        return;
      }

      toast.success('Post deleted successfully');
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setMarketplacePosts((prev) => prev.filter((p) => p.id !== postId));
      setHiringPosts((prev) => prev.filter((p) => p.id !== postId));
      setPortfolioPosts((prev) => prev.filter((p) => p.id !== postId));
      setServicePosts((prev) => prev.filter((p) => p.id !== postId));
      setPostsCount((prev) => prev - 1);
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleEditPost = async (postId: string) => {
    let post = posts.find((p) => p.id === postId);
    if (!post) post = marketplacePosts.find((p) => p.id === postId);
    if (!post) post = hiringPosts.find((p) => p.id === postId);
    if (!post) post = portfolioPosts.find((p) => p.id === postId);

    if (post) {
      setEditingPost(post);
      setEditModalOpen(true);
    }
  };

  const handleBoostPost = async (e: React.MouseEvent, postId: string, isListing: boolean) => {
    e.stopPropagation();
    if (!currentUserId) return;
    const { data: balData } = await supabase.from('credits_balance').select('balance').eq('user_id', currentUserId).maybeSingle();
    const allPosts = [...posts, ...marketplacePosts, ...servicePosts, ...hiringPosts];
    const post = allPosts.find(p => p.id === postId);
    setBoostBalance(balData?.balance ?? 0);
    setBoostModal({ postId, isListing, promotedUntil: post?.promoted_until ?? null });
  };

  const handleBoostSuccess = (postId: string, newPromotedUntil: string) => {
    setBoostModal(null);
    const updater = (prev: Post[]) => prev.map(p => p.id === postId ? { ...p, promoted_until: newPromotedUntil } : p);
    setPosts(updater);
    setMarketplacePosts(updater);
    setServicePosts(updater);
    setHiringPosts(updater);
  };


  const handleSaveEdit = async () => {
    fetchPosts();
    fetchMarketplacePosts();
    fetchHiringPosts();
    fetchPortfolioPosts();
    fetchServicePosts();
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-8 pb-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <Skeleton className="h-64 w-full mb-6 rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const averageRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;

  const filteredMarketplacePosts =
    listingFilter === 'all' ? marketplacePosts : marketplacePosts.filter((p) => p.post_type === listingFilter);

  const listingFilters =
    profile.account_type === 'customer'
      ? [
          { value: 'all', label: t('profile.allListings') },
          { value: 'service_request', label: t('profile.serviceRequests') },
          { value: 'job_seeker_post', label: t('profile.jobSeekerPosts') },
        ]
      : [
          { value: 'all', label: t('profile.allListings') },
          { value: 'hiring_post', label: t('profile.hiringPosts') },
          { value: 'service_listing', label: t('profile.serviceListings') },
          { value: 'portfolio_post', label: t('profile.portfolioPosts') },
          { value: 'service_request', label: t('profile.serviceRequests') },
          { value: 'job_seeker_post', label: t('profile.jobSeekerPosts') },
        ];

  const tabTriggerClass =
    'px-4 py-2.5 text-sm font-medium rounded-xl border border-transparent transition-all duration-200 ' +
    'text-muted-foreground hover:text-foreground hover:bg-accent ' +
    'data-[state=active]:bg-orange-500/5 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:border-orange-300 dark:data-[state=active]:border-orange-500/60 data-[state=active]:shadow-sm';

  const cardClass = 'bg-card text-card-foreground border border-border rounded-2xl shadow-sm';
  const hoverCardClass =
    'bg-card text-card-foreground border border-border rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-orange-400/40';

  return (
    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-6 pb-24 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">

        <ProfileHeader
          name={profile.name}
          avatarUrl={profile.avatar_url}
          city={profile.city}
          country={profile.country}
          phone={profile.phone}
          email={profile.email}
          websiteUrl={profile.website_url}
          showPhone={profile.show_phone}
          showEmail={profile.show_email}
          isOwnProfile={isOwnProfile}
          isLoggedIn={isLoggedIn}
          category={profile.category}
          bio={profile.bio}
          accountType={profile.account_type}
          isPro={profile.is_premium}
          isPremium={profile.is_premium}
          skills={profile.skills}
          averageRating={profile.average_rating || (averageRating ? parseFloat(averageRating) : null)}
          reviewCount={profile.review_count || reviews.length}
          viewerAccountType={profile.account_type}
          postsCount={postsCount}
          followersCount={followersCount}
          followingCount={followingCount}
          onFollowersClick={() => { setFollowListType('followers'); setFollowListOpen(true); }}
          onFollowingClick={() => { setFollowListType('following'); setFollowListOpen(true); }}
          actions={
            (!isOwnProfile && currentUserId) || headerActions ? (
              <div className="flex gap-2 w-full">
                {!isOwnProfile && currentUserId && (
                  <div className="flex-1">
                    <FollowButton
                      targetUserId={profile.id}
                      currentUserId={currentUserId}
                      onFollowChange={(following) => setFollowersCount(prev => following ? prev + 1 : prev - 1)}
                      className="w-full justify-center"
                    />
                  </div>
                )}
                {headerActions && (
                  <div className="flex-1">
                    {headerActions}
                  </div>
                )}
                {callAction && (
                  <div className="flex-1">
                    {callAction}
                  </div>
                )}
              </div>
            ) : undefined
          }
          reviewAction={reviewAction}
        />


        {/* PRO Premium badge */}
        {(profile as any).is_premium && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/5 border border-orange-400/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🔶</span>
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{t('credits.creatorPremiumBadge')}</span>
            </div>
            {!isOwnProfile && (
              <button
                onClick={() => setSupportModalOpen(true)}
                className="relative flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-amber-500 hover:text-amber-600 shrink-0"
                title={t('credits.support.button')}
              >
                <span className="absolute inset-0 rounded-lg animate-ping bg-amber-400 opacity-25" />
                <Coins className="relative h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* GigZone Krediti — own profile only */}
        {isOwnProfile && (
          <>
            <CreditsWidget profile={profile} t={t} />
          </>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          {/* Tab bar - single scrollable, Instagram underline style */}
          <div className="bg-card border border-border rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div ref={tabsScrollRef} className="overflow-x-auto overflow-y-hidden">
              <TabsList className="flex w-max min-w-full bg-transparent h-auto p-0 gap-0">
                {[
                  { value: 'activity', label: t('profile.activity'), icon: <FileText className="h-4 w-4" /> },
                  { value: 'services', label: t('profile.services'), icon: <Briefcase className="h-4 w-4" /> },
                  { value: 'portfolio', label: 'Portfolio', icon: <Star className="h-4 w-4" /> },
                  { value: 'reviews', label: t('profile.reviews'), icon: <StarIcon className="h-4 w-4" /> },
                  { value: 'listings', label: t('profile.myListings'), icon: <Briefcase className="h-4 w-4" /> },
                  ...(isOwnProfile ? [{ value: 'saved', label: t('profile.saved'), icon: <Bookmark className="h-4 w-4" /> }] : []),
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap shrink-0 rounded-none border-b-2 border-transparent text-muted-foreground transition-all duration-200
                      data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400
                      hover:text-foreground hover:bg-accent/50 bg-transparent"
                  >
                    {tab.icon}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="activity">
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground mb-1">{t('profile.noPostsYet')}</p>
                {isOwnProfile && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">Share your first post on the feed</p>
                    <Button onClick={() => router.push('/feed')} className="gap-2 rounded-xl bg-orange-600 hover:bg-orange-700" size="sm">
                      <Plus className="h-4 w-4" />
                      {t('profile.createFirstPost')}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black group shadow-sm border border-border"
                  >
                    <div
                      className="absolute inset-0 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => router.push(`/posts/${post.id}`)}
                    >
                      {post.media && post.media.length > 0 ? (
                        post.media[0].type === 'image' ? (
                          <Image
                            fill
                            src={post.media[0].url}
                            alt={(post.text || '').slice(0, 80) || 'GigZone post'}
                            className="object-cover"
                            sizes="(max-width: 768px) calc(50vw - 24px), calc(33vw - 24px)"
                          />
                        ) : (
                          <>
                            <video src={post.media[0].url} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="bg-black/60 rounded-full p-2.5">
                                <svg className="h-6 w-6 text-white fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          </>
                        )
                      ) : (
                        <div className="flex items-center justify-center h-full p-4 bg-gradient-to-br from-slate-800 to-slate-900">
                          <p className="text-white text-sm text-center line-clamp-4">{post.text || ''}</p>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />

                      <div className="absolute bottom-3 left-2 right-2 flex items-center justify-between text-white text-xs gap-1">
                        <div className="flex items-center gap-0.5 opacity-80">
                          <Eye className="h-3 w-3" />
                          <span className="drop-shadow-lg">{post.views_count || 0}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isOwnProfile) openLikesDialog(post.id);
                          }}
                          className={`flex items-center gap-0.5 ${isOwnProfile ? 'hover:scale-110 transition-transform cursor-pointer' : 'cursor-default'}`}
                        >
                          <Heart className={`h-3 w-3 ${post.user_has_reacted ? 'fill-red-500 text-red-500' : ''}`} />
                          <span className="drop-shadow-lg">{post.reactions_count}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCommentsSheetPostId(post.id);
                          }}
                          className="flex items-center gap-0.5 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span className="drop-shadow-lg">{post.comments_count}</span>
                        </button>
                      </div>
                    </div>

                    {isOwnProfile && (
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleBoostPost(e, post.id, false)}
                          disabled={boostingPostId === post.id || (!!post.promoted_until && new Date(post.promoted_until) > new Date())}
                          className="h-8 w-8 flex items-center justify-center bg-black/50 hover:bg-orange-500/80 text-white backdrop-blur-sm rounded-xl transition-colors disabled:opacity-50"
                          title={post.promoted_until && new Date(post.promoted_until) > new Date() ? t('credits.boost.active') : 'Boost (75 kr, 3d)'}
                        >
                          {boostingPostId === post.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : post.promoted_until && new Date(post.promoted_until) > new Date()
                              ? <Sparkles className="h-4 w-4 text-orange-400" />
                              : <Zap className="h-4 w-4" />}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-xl"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPost(post.id);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('posts.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                              }}
                              className="text-red-600 focus:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('posts.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="listings">
            <div className="mb-4 bg-card border border-border rounded-2xl p-3 flex gap-2 flex-wrap items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {listingFilters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setListingFilter(filter.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      listingFilter === filter.value
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {isOwnProfile && (
                <Button
                  onClick={() => setAdTypePickerOpen(true)}
                  className="gap-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl h-8"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('profile.createListing')}
                </Button>
              )}
            </div>

            {filteredMarketplacePosts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground mb-1">{t('profile.noListings')}</p>
                {isOwnProfile && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">{t('profile.noListingsDesc')}</p>
                    <Button
                      onClick={() => setAdTypePickerOpen(true)}
                      className="gap-2 bg-orange-600 hover:bg-orange-700 rounded-xl"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      {t('profile.createFirstListing')}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMarketplacePosts.map((post: any) => {
                  if (post.post_type === 'service_listing') {
                    return (
                      <ServiceListingCard
                        key={post.id}
                        post={post}
                        currentUserId={currentUserId}
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                      />
                    );
                  }

                  return (
                    <Card key={post.id} className={hoverCardClass}>
                      <CardContent className="pt-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    post.post_type === 'service_request'
                                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                      : post.post_type === 'job_seeker_post'
                                      ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                      : post.post_type === 'hiring_post'
                                      ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {post.post_type === 'service_request' && t('jobs.badgeServiceRequest')}
                                  {post.post_type === 'job_seeker_post' && t('jobs.badgeJobSeeker')}
                                  {post.post_type === 'hiring_post' && t('jobs.badgeHiring')}
                                  {post.post_type === 'portfolio_post' && t('jobs.badgePortfolio')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </span>
                              </div>

                              {post.text &&
                                (() => {
                                  const isLong = post.text.length > 180;
                                  const isExpanded = expandedText[post.id];

                                  return (
                                    <div>
                                      <div className={`relative ${isExpanded ? '' : 'max-h-[120px] overflow-hidden'}`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-line">{post.text}</p>

                                        {!isExpanded && isLong && (
                                          <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                                        )}
                                      </div>

                                      {isLong && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedText((prev) => ({
                                              ...prev,
                                              [post.id]: !prev[post.id],
                                            }));
                                          }}
                                          className="mt-1 text-sm font-medium text-primary hover:underline"
                                        >
                                          {isExpanded ? t('posts.showLess') : t('posts.readMore')}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                              {(post.post_type === 'job_seeker_post' || post.post_type === 'portfolio_post') && (
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                  {post.profession && (
                                    <div>
                                      <span className="text-muted-foreground">Profession:</span>
                                      <span className="ml-1 font-medium">{post.profession}</span>
                                    </div>
                                  )}
                                  {post.experience_level && (
                                    <div>
                                      <span className="text-muted-foreground">Experience:</span>
                                      <span className="ml-1 font-medium">{post.experience_level}</span>
                                    </div>
                                  )}
                                  {post.location && (
                                    <div>
                                      <span className="text-muted-foreground">{t('profile.location')}:</span>
                                      <span className="ml-1 font-medium">{post.location}</span>
                                    </div>
                                  )}
                                  {post.availability && (
                                    <div>
                                      <span className="text-muted-foreground">Available:</span>
                                      <span className="ml-1 font-medium">{post.availability}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {post.media && post.media.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                  {post.media.map((media: PostMedia) => (
                                    <div key={media.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
                                      {media.type === 'image' ? (
                                        <Image fill src={media.url} alt="Post media" className="object-cover" sizes="(max-width: 768px) calc(33vw - 16px), 280px" />
                                      ) : (
                                        <video src={media.url} className="w-full h-full object-cover" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {isOwnProfile && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleBoostPost(e, post.id, true)}
                                  disabled={boostingPostId === post.id || (!!post.promoted_until && new Date(post.promoted_until) > new Date())}
                                  className="h-8 px-2 flex items-center gap-1 text-xs rounded-xl border border-orange-300 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-40 transition-colors"
                                  title={post.promoted_until && new Date(post.promoted_until) > new Date() ? t('credits.boost.active') : 'Boost (140 kr, 7d)'}
                                >
                                  {boostingPostId === post.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : post.promoted_until && new Date(post.promoted_until) > new Date()
                                      ? <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                                      : <Zap className="h-3.5 w-3.5" />}
                                  <span>{post.promoted_until && new Date(post.promoted_until) > new Date() ? t('credits.boost.active.label') : t('credits.boost.boost.label')}</span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem onClick={() => handleEditPost(post.id)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      {t('posts.edit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeletePost(post.id)}
                                      className="text-red-600 focus:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t('posts.delete')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <>
              <TabsContent value="services">
                {servicePosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noServices')}</p>
                    {isOwnProfile && (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">Add your services to attract customers</p>
                        <Button onClick={() => { setInitialPostType('service_listing'); setCreateMarketplaceModalOpen(true); }} className="gap-2 rounded-xl bg-orange-600 hover:bg-orange-700" size="sm">
                          <Plus className="h-4 w-4" />
                          {t('profile.createFirstService')}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {isOwnProfile && (
                      <div className="mb-4 flex justify-end">
                        <Button onClick={() => { setInitialPostType('service_listing'); setCreateMarketplaceModalOpen(true); }} className="gap-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl h-8" size="sm">
                          <Plus className="h-3.5 w-3.5" />
                          {t('profile.offerService')}
                        </Button>
                      </div>
                    )}
                    <div className="space-y-4">
                      {servicePosts.map((post: any) => (
                        <div key={post.id} className="relative">
                          <ServiceListingCard
                            post={post}
                            currentUserId={currentUserId}
                            onEdit={handleEditPost}
                            onDelete={handleDeletePost}
                          />
                          {isOwnProfile && (
                            <div className="mt-1 flex justify-end px-1">
                              <button
                                onClick={(e) => handleBoostPost(e, post.id, true)}
                                disabled={boostingPostId === post.id || (!!post.promoted_until && new Date(post.promoted_until) > new Date())}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-orange-300 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-40 transition-colors"
                              >
                                {boostingPostId === post.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : post.promoted_until && new Date(post.promoted_until) > new Date()
                                    ? <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                                    : <Zap className="h-3.5 w-3.5" />}
                                {post.promoted_until && new Date(post.promoted_until) > new Date()
                                  ? t('credits.boost.active.label')
                                  : 'Boost (140 kr, 7d)'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="portfolio">
                {portfolioPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noPortfolio')}</p>
                    {isOwnProfile && (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">{t('profile.portfolioShowcase')}</p>
                        <Button onClick={() => { setInitialPostType('portfolio_post'); setCreateMarketplaceModalOpen(true); }} className="gap-2 rounded-xl bg-orange-600 hover:bg-orange-700" size="sm">
                          <Plus className="h-4 w-4" />
                          {t('profile.addPortfolioItem')}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {isOwnProfile && (
                      <div className="mb-4 flex justify-end">
                        <Button onClick={() => { setInitialPostType('portfolio_post'); setCreateMarketplaceModalOpen(true); }} className="gap-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl h-8" size="sm">
                          <Plus className="h-3.5 w-3.5" />
                          {t('profile.addPortfolioItem')}
                        </Button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {portfolioPosts.map((post: any) => (
                        <Card key={post.id} className={hoverCardClass}>
                          <CardContent className="pt-4 pb-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                    >
                                      Portfolio
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                    </span>
                                  </div>

                                  {post.text &&
                                    (() => {
                                      const isLong = post.text.length > 180;
                                      const isExpanded = expandedText[post.id];

                                      return (
                                        <div>
                                          <div className={`relative ${isExpanded ? '' : 'max-h-[120px] overflow-hidden'}`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-line">{post.text}</p>

                                            {!isExpanded && isLong && (
                                              <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                                            )}
                                          </div>

                                          {isLong && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedText((prev) => ({
                                                  ...prev,
                                                  [post.id]: !prev[post.id],
                                                }));
                                              }}
                                              className="mt-1 text-sm font-medium text-primary hover:underline"
                                            >
                                              {isExpanded ? t('posts.showLess') : t('posts.readMore')}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

                                  {post.media && post.media.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                      {post.media.map((media: PostMedia) => (
                                        <div key={media.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
                                          {media.type === 'image' ? (
                                            <Image fill src={media.url} alt="Portfolio media" className="object-cover" sizes="(max-width: 768px) calc(33vw - 16px), 280px" />
                                          ) : (
                                            <video src={media.url} className="w-full h-full object-cover" />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {isOwnProfile && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                      <DropdownMenuItem onClick={() => handleEditPost(post.id)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeletePost(post.id)}
                                        className="text-red-600 focus:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="hiring">
                {hiringPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noOpenPositions')}</p>
                    {isOwnProfile && (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">Post a job opening to find talent</p>
                        <Button onClick={() => { setInitialPostType('hiring_post'); setCreateMarketplaceModalOpen(true); }} className="gap-2 rounded-xl bg-orange-600 hover:bg-orange-700" size="sm">
                          <Plus className="h-4 w-4" />
                          {t('profile.postJobOpening')}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {isOwnProfile && (
                      <div className="mb-4 flex justify-end">
                        <Button onClick={() => { setInitialPostType('hiring_post'); setCreateMarketplaceModalOpen(true); }} className="gap-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl h-8" size="sm">
                          <Plus className="h-3.5 w-3.5" />
                          {t('profile.postJobOpening')}
                        </Button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {hiringPosts.map((post: any) => (
                        <Card key={post.id} className={hoverCardClass}>
                          <CardContent className="pt-4 pb-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                                    >
                                      {t('jobs.badgeHiring')}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                    </span>
                                  </div>

                                  {post.job_title && <h3 className="font-semibold text-base mb-1">{post.job_title}</h3>}

                                  {post.text &&
                                    (() => {
                                      const isLong = post.text.length > 180;
                                      const isExpanded = expandedText[post.id];

                                      return (
                                        <div>
                                          <div className={`relative ${isExpanded ? '' : 'max-h-[120px] overflow-hidden'}`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-line">{post.text}</p>

                                            {!isExpanded && isLong && (
                                              <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                                            )}
                                          </div>

                                          {isLong && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedText((prev) => ({
                                                  ...prev,
                                                  [post.id]: !prev[post.id],
                                                }));
                                              }}
                                              className="mt-1 text-sm font-medium text-primary hover:underline"
                                            >
                                              {isExpanded ? t('posts.showLess') : t('posts.readMore')}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

                                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    {post.category && (
                                      <div>
                                        <span className="text-muted-foreground">{t('profile.category')}:</span>
                                        <span className="ml-1 font-medium">{post.category}</span>
                                      </div>
                                    )}
                                    {post.city && (
                                      <div>
                                        <span className="text-muted-foreground">{t('profile.location')}:</span>
                                        <span className="ml-1 font-medium">{post.city}</span>
                                      </div>
                                    )}
                                  </div>

                                  {post.media && post.media.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                      {post.media.map((media: PostMedia) => (
                                        <div key={media.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
                                          {media.type === 'image' ? (
                                            <Image fill src={media.url} alt="Job media" className="object-cover" sizes="(max-width: 768px) calc(33vw - 16px), 280px" />
                                          ) : (
                                            <video src={media.url} className="w-full h-full object-cover" />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {isOwnProfile && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                      <DropdownMenuItem onClick={() => handleEditPost(post.id)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeletePost(post.id)}
                                        className="text-red-600 focus:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Star className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noReviews')}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.reviewsEmpty')}</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-yellow-50/50 to-orange-50/30 dark:from-yellow-950/20 dark:to-orange-950/10 p-5 flex items-center gap-5">
                      <div className="text-center flex-shrink-0">
                        <div className="text-4xl font-bold text-foreground">{averageRating}</div>
                        <div className="flex items-center gap-0.5 mt-1.5 justify-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < Math.round(parseFloat(averageRating!)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>
                      </div>
                      <div className="flex-1 h-px bg-border" />
                      <div className="text-sm text-muted-foreground text-right">
                        <p className="font-medium text-foreground">Excellent</p>
                        <p>Based on customer feedback</p>
                      </div>
                    </div>

                    {reviews.map((review) => (
                      <Card key={review.id} className={hoverCardClass}>
                        <CardContent className="pt-4 pb-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-9 w-9">
                                  {review.customer?.avatar_url ? (
                                    <AvatarImage src={review.customer.avatar_url} alt={review.customer.name} />
                                  ) : (
                                    <AvatarFallback className="bg-slate-600 text-white text-sm">
                                      {review.customer ? review.customer.name.charAt(0).toUpperCase() : 'D'}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-sm">{review.customer?.name || 'Deleted user'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3.5 w-3.5 ${
                                      i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            {review.comment && <p className="text-muted-foreground leading-relaxed text-sm">{review.comment}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </TabsContent>
          </>

          {isOwnProfile && (
            <TabsContent value="saved">
              {/* Saved subtabs */}
              <div className="flex gap-2 mb-4 border-b border-border">
                {(['feed', 'services', 'jobs'] as const).map((tab) => {
                  const labels = {
                    feed: t('profile.savedTabFeed'),
                    services: t('profile.savedTabServices'),
                    jobs: t('profile.savedTabJobs'),
                  };
                  const counts = {
                    feed: savedPosts.filter((p) => !p.post_type || p.post_type === 'social_post').length,
                    services: savedPosts.filter((p) => p.post_type === 'service_listing').length,
                    jobs: savedPosts.filter((p) => ['hiring_post', 'service_request', 'job_seeker_post'].includes(p.post_type || '')).length,
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setSavedTab(tab)}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        savedTab === tab
                          ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {labels[tab]}
                      {counts[tab] > 0 && (
                        <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{counts[tab]}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feed subtab */}
              {savedTab === 'feed' && (() => {
                const feedPosts = savedPosts.filter((p) => !p.post_type || p.post_type === 'social_post');
                return feedPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Bookmark className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noSavedFeed')}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.noSavedFeedHint')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {feedPosts.map((post) => (
                      <div
                        key={post.id}
                        className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black group shadow-sm border border-border cursor-pointer"
                        onClick={() => router.push(`/posts/${post.id}`)}
                      >
                        {post.media && post.media.length > 0 ? (
                          post.media[0].type === 'image' ? (
                            <Image fill src={post.media[0].url} alt="" className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) calc(50vw - 24px), calc(33vw - 24px)" />
                          ) : (
                            <video src={post.media[0].url} className="w-full h-full object-cover" muted playsInline />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-3">
                            <p className="text-white text-xs text-center line-clamp-6 leading-relaxed">{post.text}</p>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Bookmark className="h-4 w-4 fill-white text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Services subtab */}
              {savedTab === 'services' && (() => {
                const servicePosts = savedPosts.filter((p) => p.post_type === 'service_listing');
                return servicePosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Bookmark className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noSavedServices')}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.noSavedServicesHint')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {servicePosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex gap-3 p-3 rounded-2xl border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                        onClick={() => router.push(`/services/${post.id}`)}
                      >
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                          {post.media && post.media.length > 0 ? (
                            <Image fill src={post.media[0].url} alt="" className="object-cover" sizes="64px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🔧</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{post.job_title || t('profile.savedTabServices')}</p>
                          <button
                            className="text-xs text-muted-foreground truncate hover:text-orange-500 transition-colors text-left"
                            onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.user_id}`); }}
                          >
                            {post.user?.name || ''}
                          </button>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {post.category && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800">{post.category}</span>
                            )}
                            {post.city && <span className="text-xs text-muted-foreground">{post.city}</span>}
                          </div>
                          {post.price_type && (
                            <p className="text-xs font-medium text-foreground mt-1">
                              {post.price_type === 'negotiable'
                                ? 'Po dogovoru'
                                : post.price_value
                                ? `${post.price_value} ${post.currency || 'RSD'}${post.price_type === 'hourly' ? '/h' : ''}`
                                : null}
                            </p>
                          )}
                        </div>
                        <Bookmark className="h-4 w-4 fill-orange-500 text-orange-500 flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Jobs subtab */}
              {savedTab === 'jobs' && (() => {
                const jobTypes = ['hiring_post', 'service_request', 'job_seeker_post'];
                const jobPosts = savedPosts.filter((p) => jobTypes.includes(p.post_type || ''));
                const typeBadge: Record<string, { label: string; cls: string }> = {
                  hiring_post: { label: t('profile.savedJobTypeHiring'), cls: 'bg-orange-100 text-orange-700' },
                  service_request: { label: t('profile.savedJobTypeRequest'), cls: 'bg-blue-100 text-blue-700' },
                  job_seeker_post: { label: t('profile.savedJobTypeSeeker'), cls: 'bg-green-100 text-green-700' },
                };
                return jobPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-accent/20 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Bookmark className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('profile.noSavedJobs')}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.noSavedJobsHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobPosts.map((post) => {
                      const badge = typeBadge[post.post_type || ''];
                      return (
                        <div
                          key={post.id}
                          className="flex items-start gap-3 p-3 rounded-2xl border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                          onClick={() => router.push('/jobs')}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Avatar
                                className="h-6 w-6 flex-shrink-0 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.user_id}`); }}
                              >
                                <AvatarImage src={post.user?.avatar_url} alt={post.user?.name} />
                                <AvatarFallback className="bg-orange-500 text-white text-[10px]">
                                  {post.user?.name?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <button
                                className="text-sm font-medium text-foreground truncate hover:text-orange-500 transition-colors text-left"
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.user_id}`); }}
                              >
                                {post.user?.name || ''}
                              </button>
                              {badge && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                              )}
                            </div>
                            <p className="font-semibold text-sm truncate">{post.job_title || post.category || post.text?.substring(0, 60) || t('profile.savedTabJobs')}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {post.category && <span>{post.category}</span>}
                              {post.city && <span>• {post.city}</span>}
                              {post.experience_level && <span>• {post.experience_level}</span>}
                            </div>
                            {post.text && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{post.text}</p>
                            )}
                          </div>
                          <Bookmark className="h-4 w-4 fill-orange-500 text-orange-500 flex-shrink-0 mt-0.5" />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          )}
        </Tabs>

        {editingPost && isOwnProfile && (
          <EditPostModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            postId={editingPost.id}
            postType={(editingPost.post_type as any) || 'service_request_post'}
            initialText={editingPost.text}
            media={editingPost.media}
            initialCategory={editingPost.category}
            initialCity={editingPost.city}
            initialExperienceLevel={editingPost.experience_level}
            initialAvailability={editingPost.availability}
            initialProfession={editingPost.profession}
            initialLocation={editingPost.location}
            initialJobTitle={editingPost.job_title}
            initialPriceType={editingPost.price_type}
            initialPriceValue={editingPost.price_value}
            initialCurrency={editingPost.currency}
            onSave={handleSaveEdit}
          />
        )}

        <Dialog open={adTypePickerOpen} onOpenChange={setAdTypePickerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('jobs.createPost')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {([
                { type: 'service_listing' as const, icon: <Wrench className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeServiceListing'), desc: t('jobs.postTypeServiceListingDesc') },
                { type: 'service_request' as const, icon: <Search className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeServiceRequest'), desc: t('jobs.postTypeServiceRequestDesc') },
                { type: 'job_seeker_post' as const, icon: <UserCircle className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeJobSeeker'), desc: t('jobs.postTypeJobSeekerDesc') },
                { type: 'hiring_post' as const, icon: <Briefcase className="h-5 w-5 text-orange-400" />, title: t('jobs.postTypeHiring'), desc: t('jobs.postTypeHiringDesc') },
              ] as const).map(({ type, icon, title, desc }) => (
                <button
                  key={type}
                  onClick={() => { setInitialPostType(type); setAdTypePickerOpen(false); setCreateMarketplaceModalOpen(true); }}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">{icon}</div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {isOwnProfile && (
          <CreateMarketplacePostModal
            open={createMarketplaceModalOpen}
            onOpenChange={setCreateMarketplaceModalOpen}
            initialPostType={initialPostType}
            onPostCreated={() => {
              fetchMarketplacePosts();
              fetchServicePosts();
              fetchHiringPosts();
              fetchPortfolioPosts();
            }}
          />
        )}
      </div>

      <FollowListSheet
        open={followListOpen}
        onOpenChange={setFollowListOpen}
        profileId={profile.id}
        type={followListType}
      />

      {/* Who Liked Dialog */}
      <Dialog open={!!likesDialogPostId} onOpenChange={(o) => { if (!o) setLikesDialogPostId(null); }}>
        <DialogContent className="max-w-sm w-full p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              Lajkovi
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] py-2 px-3">
            {likedByLoading ? (
              <div className="space-y-3 py-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : likedByUsers.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nema lajkova još</p>
            ) : (
              <div className="space-y-1">
                {likedByUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => { setLikesDialogPostId(null); router.push(`/profile/${u.id}`); }}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={u.avatar_url} alt={u.name} />
                      <AvatarFallback className="bg-orange-600 text-white font-semibold text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{u.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Sheet */}
      {commentsSheetPostId && (
        <CommentsSheet
          open={!!commentsSheetPostId}
          onOpenChange={(o) => { if (!o) setCommentsSheetPostId(null); }}
          postId={commentsSheetPostId}
          commentsCount={posts.find((p) => p.id === commentsSheetPostId)?.comments_count || 0}
          onCommentAdded={() => {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === commentsSheetPostId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
              )
            );
          }}
        />
      )}

      {/* Delete Post Confirmation */}
      <AlertDialog open={postToDelete !== null} onOpenChange={(open) => { if (!open) setPostToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('posts.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('posts.deleteConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('posts.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePost} className="bg-red-600 hover:bg-red-700">
              {t('posts.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {boostModal && currentUserId && (
        <BoostModal
          open={!!boostModal}
          onClose={() => setBoostModal(null)}
          postId={boostModal.postId}
          isListing={boostModal.isListing}
          currentPromotedUntil={boostModal.promotedUntil}
          userId={currentUserId}
          balance={boostBalance}
          onSuccess={(newPromotedUntil) => handleBoostSuccess(boostModal.postId, newPromotedUntil)}
        />
      )}

      <SupportModal
        open={supportModalOpen}
        onOpenChange={setSupportModalOpen}
        targetUserId={profile.id}
        targetUserName={profile.name}
        targetIsCreatorPremium={(profile as any).is_premium ?? false}
      />
    </div>
  );
}
