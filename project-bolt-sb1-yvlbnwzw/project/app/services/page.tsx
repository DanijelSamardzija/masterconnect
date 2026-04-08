'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { ProfessionalCard } from '@/components/professional-card';
import { CategoryCombobox } from '@/components/category-combobox';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/empty-state';
import { Loader2, Search, Filter, X, Bookmark } from 'lucide-react';

export const revalidate = 0;

type ServiceListing = {
  id: string;
  user_id: string;
  text: string;
  job_title: string;
  category: string;
  city: string;
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
  };
  post_media: Array<{
    id: string;
    type: string;
    url: string;
    order: number;
  }>;
};

export default function ServicesPage() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  usePageTracking('services');
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [hasFilters, setHasFilters] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

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
    setHasFilters(!!selectedCategory || !!cityFilter);
  }, [selectedCategory, cityFilter]);

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
          profiles (
            name,
            avatar_url,
            account_type,
            average_rating,
            review_count
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
        query = query.ilike('city', `%${cityFilter}%`);
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

      const sortedListings = sortByWeightedRating(listingsWithReviews);
      setListings(sortedListings);
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
  };

  return (
  <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] min-h-screen">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('discover.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('discover.subtitle')}
        </p>
      </div>

      {/* FILTER CARD */}
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm p-6 mb-6 transition-all duration-200 hover:shadow-md">

        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {hasFilters && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2 rounded-xl"
            >
              <X className="h-4 w-4" />
              {t('discover.clearFilters')}
            </Button>
          </div>
        )}
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
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="relative transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
            >
              <ProfessionalCard listing={listing} />
              {user && (
                <button
                  onClick={(e) => handleSaveListing(e, listing.id)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
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
          ))}
        </div>
      )}

    </div>
  </div>
);
}
