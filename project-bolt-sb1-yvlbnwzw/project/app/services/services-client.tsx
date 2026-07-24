'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { countries } from '@/lib/countries';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { ProfessionalCard } from '@/components/professional-card';
import { GuestWall } from '@/components/guest-wall';
import { CategoryCombobox } from '@/components/category-combobox';
import { CityAutocomplete, cyrillicToLatin } from '@/components/city-autocomplete';
import { locationScore } from '@/lib/location-sort';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/empty-state';
import { SharePostModal } from '@/components/share-post-modal';
import { Loader2, Search, Filter, X, Bookmark, Share2, ArrowUpDown, Star, Clock, TrendingUp, Plus, Sparkles, Zap } from 'lucide-react';
import { CreateMarketplacePostModal } from '@/components/create-marketplace-post-modal';
import { NotifyMeButton } from '@/components/notify-me-button';
import { BoostModal } from '@/components/boost-modal';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { buildFtsQuery } from '@/lib/search/build-fts-query';

export const revalidate = 0;

type ServiceListing = {
  id: string;
  user_id: string;
  text: string;
  job_title: string;
  category: string;
  city: string;
  country?: string | null;
  price_type?: string;
  price_value?: number;
  currency?: string;
  created_at: string;
  profiles: {
    name: string;
    avatar_url?: string;
    account_type?: string;
    average_rating?: number;
    review_count?: number;
    last_seen?: string;
    is_premium?: boolean;
  };
  post_media: Array<{
    id: string;
    type: string;
    url: string;
    order: number;
  }>;
};

interface ServicesClientProps {
  initialSearch?: string;
}

export function ServicesClient({ initialSearch = '' }: ServicesClientProps) {
  const { profile, user } = useAuth();
  const { t, language } = useLanguage();
  usePageTracking('services');
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [hasFilters, setHasFilters] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [shareModalPostId, setShareModalPostId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'newest' | 'price_asc' | 'price_desc'>('rating');
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [boostTarget, setBoostTarget] = useState<{ postId: string; promotedUntil: string | null } | null>(null);
  const [boostBalance, setBoostBalance] = useState(0);
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const isFirstRender = useRef(true);

  useEffect(() => {
    loadCategories();
    loadListings();
  }, []);

  useEffect(() => {
    if (user) fetchSavedServices();
    else setSavedSet(new Set());
  }, [user?.id]);

  useEffect(() => {
    loadListings();
    setHasFilters(!!selectedCategory || !!cityFilter || !!countryFilter || !!searchQuery);
  }, [selectedCategory, cityFilter, countryFilter, sortBy, searchQuery]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      const path = searchInput.trim()
        ? `/services?q=${encodeURIComponent(searchInput.trim())}`
        : '/services';
      router.replace(path, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?post_type=service_listing');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          job_title,
          category,
          city,
          country,
          price_type,
          price_value,
          currency,
          created_at,
          status,
          spam_score,
          rank_penalty,
          phone_count,
          link_count,
          hashtag_count,
          is_promoted,
          promoted_until,
          profiles (
            name,
            avatar_url,
            account_type,
            average_rating,
            review_count,
            last_seen,
            is_premium,
            city,
            country
          ),
          post_media (
            id,
            type,
            url,
            order
          )
        `)
        .eq('post_type', 'service_listing')
        .eq('is_active', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        const normalizedCategory = normalizeCategory(selectedCategory);
        query = query.eq('category_normalized', normalizedCategory);
      }

      if (cityFilter) {
        query = query.ilike('city', `%${cyrillicToLatin(cityFilter)}%`);
      }

      if (countryFilter) {
        query = query.eq('country', countryFilter);
      }

      const ftsQuery = searchQuery.trim() ? buildFtsQuery(searchQuery) : null;
      if (ftsQuery) {
        query = query.textSearch('search_vector', ftsQuery, { config: 'simple' });
      }

      const { data, error } = await query;

      if (error) throw error;

      const postsData = (data as any) || [];
      const professionalUserIds = postsData
        .filter((p: any) => p.profiles?.account_type === 'professional')
        .map((p: any) => p.user_id);

      let reviewsData: any[] = [];

      if (professionalUserIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('pro_id, rating')
          .in('pro_id', professionalUserIds);

        reviewsData = reviews || [];
      }

      const reviewStats = professionalUserIds.reduce((acc: any, userId: string) => {
        const userReviews = reviewsData.filter((r: any) => r.pro_id === userId);
        if (userReviews.length > 0) {
          const avgRating = userReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / userReviews.length;
          acc[userId] = {
            average_rating: Math.round(avgRating * 10) / 10,
            review_count: userReviews.length
          };
        }
        return acc;
      }, {});

      const listingsWithReviews = postsData.map((post: any) => ({
        ...post,
        profiles: post.profiles ? {
          ...post.profiles,
          ...(reviewStats[post.user_id] || {})
        } : null
      }));

      const sorted = applySorting(listingsWithReviews, sortBy);
      const now = new Date();
      const adminPromoted = sorted.filter((l: any) => l.is_promoted);
      const userBoosted = sorted.filter((l: any) => !l.is_promoted && l.promoted_until && new Date(l.promoted_until) > now);
      const rest = sorted.filter((l: any) => !l.is_promoted && !(l.promoted_until && new Date(l.promoted_until) > now));

      const effectiveCountry = profile?.country || (() => {
        if (typeof navigator === 'undefined') return '';
        const lang = navigator.language || '';
        const parts = lang.split('-');
        if (parts.length >= 2) return parts[1].toLowerCase();
        const map: Record<string, string> = { hr: 'hr', sr: 'rs', bs: 'ba', de: 'de', sl: 'si', sk: 'sk', hu: 'hu' };
        return map[parts[0].toLowerCase()] || '';
      })();
      if (!cityFilter && (profile?.city || effectiveCountry)) {
        rest.sort((a: any, b: any) => {
          const sa = locationScore(profile?.city || '', effectiveCountry, a.city || '', a.profiles?.country || '');
          const sb = locationScore(profile?.city || '', effectiveCountry, b.city || '', b.profiles?.country || '');
          return sa - sb;
        });
      }
      setListings([...adminPromoted, ...userBoosted, ...rest]);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeCategory = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[đĐ]/g, 'd')
      .replace(/[šŠ]/g, 's')
      .replace(/[čČ]/g, 'c')
      .replace(/[ćĆ]/g, 'c')
      .replace(/[žŽ]/g, 'z');
  };

  const applySorting = (listings: ServiceListing[], sort: typeof sortBy): ServiceListing[] => {
    if (sort === 'newest') {
      return [...listings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (sort === 'price_asc') {
      return [...listings].sort((a, b) => {
        const aPrice = a.price_value || Infinity;
        const bPrice = b.price_value || Infinity;
        return aPrice - bPrice;
      });
    }
    if (sort === 'price_desc') {
      return [...listings].sort((a, b) => {
        const aPrice = a.price_value || 0;
        const bPrice = b.price_value || 0;
        return bPrice - aPrice;
      });
    }
    return sortByWeightedRating(listings);
  };

  const sortByWeightedRating = (listings: ServiceListing[]): ServiceListing[] => {
    return listings.sort((a, b) => {
      const aRating = a.profiles?.average_rating || 0;
      const bRating = b.profiles?.average_rating || 0;
      const aReviewCount = a.profiles?.review_count || 0;
      const bReviewCount = b.profiles?.review_count || 0;

      const aHasReviews = aReviewCount > 0;
      const bHasReviews = bReviewCount > 0;

      if (aHasReviews && !bHasReviews) {
        return -1;
      }
      if (!aHasReviews && bHasReviews) {
        return 1;
      }

      if (aHasReviews && bHasReviews) {
        if (Math.abs(aRating - bRating) >= 0.3) {
          return bRating - aRating;
        }

        if (aReviewCount !== bReviewCount) {
          return bReviewCount - aReviewCount;
        }
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const fetchSavedServices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id);
    setSavedSet(new Set((data || []).map((r: any) => r.post_id)));
  };

  const handleBoostListing = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setBoostingId(listingId);
    const { data: balData } = await supabase.from('credits_balance').select('balance').eq('user_id', user.id).maybeSingle();
    const listing = listings.find(l => l.id === listingId);
    setBoostBalance(balData?.balance ?? 0);
    setBoostTarget({ postId: listingId, promotedUntil: (listing as any)?.promoted_until ?? null });
    setBoostingId(null);
  };

  const handleSaveListing = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const isSaved = savedSet.has(listingId);
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', listingId);
      setSavedSet((prev) => { const s = new Set(prev); s.delete(listingId); return s; });
    } else {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: listingId });
      setSavedSet((prev) => new Set(prev).add(listingId));
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setCityFilter('');
    setCountryFilter('');
    setSearchInput('');
    setSearchQuery('');
    router.replace('/services', { scroll: false });
  };

  return (
  <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] min-h-screen">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      {/* HEADER */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('discover.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('discover.subtitle')}
          </p>
        </div>
        {profile?.account_type === 'professional' && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex-shrink-0 bg-orange-600 hover:bg-orange-500 text-white rounded-xl gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('discover.postService')}
          </Button>
        )}
      </div>

      {/* FILTER CARD */}
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm p-6 mb-6 transition-all duration-200 hover:shadow-md">

        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Filters</h2>
        </div>

        {/* KEYWORD SEARCH */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('discover.searchKeyword')}
            className="w-full h-10 pl-9 pr-9 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>{t('discover.allCategories')}</Label>
            <CategoryCombobox
              value={selectedCategory}
              onChange={setSelectedCategory}
              suggestions={categories}
              placeholder={t('discover.allCategories')}
              filterMode={true}
              allCategoriesLabel={t('discover.allCategories')}
            />
          </div>

          <div>
            <Label>{t('discover.filterCity')}</Label>
            <CityAutocomplete
              value={cityFilter}
              onChange={(city) => setCityFilter(city)}
              placeholder={t('discover.filterCity')}
              showAllOption={true}
            />
          </div>

          <div>
            <Label>{t('discover.filterCountry')}</Label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">{t('discover.filterCountry')}</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>{language === 'sr' ? c.sr : language === 'de' ? c.de : c.en}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort buttons */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
            <ArrowUpDown className="h-3.5 w-3.5" /> {t('discover.sortBy')}:
          </span>
          {[
            { key: 'rating', icon: <Star className="h-3 w-3" />, label: t('discover.sortRating') },
            { key: 'newest', icon: <Clock className="h-3 w-3" />, label: t('discover.sortNewest') },
            { key: 'price_asc', icon: <TrendingUp className="h-3 w-3" />, label: t('discover.sortPriceAsc') },
            { key: 'price_desc', icon: <TrendingUp className="h-3 w-3 rotate-180" />, label: t('discover.sortPriceDesc') },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as typeof sortBy)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                sortBy === opt.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted text-muted-foreground hover:bg-accent transition-colors"
            >
              <X className="h-3 w-3" /> {t('discover.clearFilters')}
            </button>
          )}
          <NotifyMeButton category={selectedCategory} city={cityFilter} />
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('discover.noResults')}
          description={hasFilters ? t('discover.clearFilters') : ''}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {(user ? listings : listings.slice(0, 7)).map((listing, idx) => (
            <React.Fragment key={listing.id}>
              <div className={`relative transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 ${(listing as any).promoted_until && new Date((listing as any).promoted_until) > new Date() ? 'ring-2 ring-orange-400 rounded-2xl' : ''}`}>
                <ProfessionalCard listing={listing} />
                {(listing as any).is_promoted && (
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">Sponzorisano</span>
                  </div>
                )}
                {(listing as any).promoted_until && new Date((listing as any).promoted_until) > new Date() && !(listing as any).is_promoted && (
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">🚀 Boost</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                  {user?.id === listing.user_id && (() => {
                    const boostActive = !!(listing as any).promoted_until && new Date((listing as any).promoted_until) > new Date();
                    const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const title = boostActive
                      ? `${t('credits.boost.activeUntil').replace('{date}', fmtDate((listing as any).promoted_until))} · ${t('credits.boost.extendInfo')}`
                      : t('credits.boost.tooltipListing');
                    return (
                      <button
                        onClick={(e) => handleBoostListing(e, listing.id)}
                        disabled={boostingId === listing.id}
                        className="p-1.5 rounded-full bg-orange-500/90 backdrop-blur-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
                        title={title}
                      >
                        {boostingId === listing.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Zap className="h-4 w-4 text-white" />}
                      </button>
                    );
                  })()}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareModalPostId(listing.id); }}
                    className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                    title={t('share.title')}
                  >
                    <Share2 className="h-5 w-5 text-white drop-shadow" />
                  </button>
                  {user && (
                    <button
                      onClick={(e) => handleSaveListing(e, listing.id)}
                      className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                      title={savedSet.has(listing.id) ? t('profile.savedRemove') : t('profile.savedSaveService')}
                    >
                      <Bookmark
                        className={`h-5 w-5 transition-all drop-shadow ${
                          savedSet.has(listing.id) ? 'fill-white text-white scale-110' : 'text-white'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
          {!user && listings.length > 7 && <GuestWall variant="page" />}
        </div>
      )}

    </div>

    {shareModalPostId && (
      <SharePostModal
        postId={shareModalPostId}
        urlPath={`/services/${shareModalPostId}`}
        open={!!shareModalPostId}
        onOpenChange={(open) => { if (!open) setShareModalPostId(null); }}
      />
    )}

    {boostTarget && user && (
      <BoostModal
        open={!!boostTarget}
        onClose={() => setBoostTarget(null)}
        postId={boostTarget.postId}
        isListing={true}
        currentPromotedUntil={boostTarget.promotedUntil}
        userId={user.id}
        balance={boostBalance}
        onSuccess={(newPromotedUntil) => {
          setListings(prev => prev.map(l => l.id === boostTarget.postId ? { ...l, promoted_until: newPromotedUntil } : l));
          setBoostTarget(null);
        }}
      />
    )}

    <CreateMarketplacePostModal
      open={showCreateModal}
      onOpenChange={setShowCreateModal}
      onPostCreated={() => { setShowCreateModal(false); loadListings(); }}
      initialPostType="service_listing"
      allowedTypes={['service_listing', 'portfolio_post', 'service_request']}
    />
  </div>
);
}
