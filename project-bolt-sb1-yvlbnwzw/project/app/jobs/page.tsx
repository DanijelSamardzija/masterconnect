'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Users, UserCircle, MessageCircle, Plus, MoreVertical, Trash2, Send, X, Bookmark, Share2, MapPin, Star, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export const revalidate = 0;

import { useLanguage } from '@/lib/contexts/language-context';
import { CreateMarketplacePostModal } from '@/components/create-marketplace-post-modal';
import { SharePostModal } from '@/components/share-post-modal';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { OfferServiceModal } from '@/components/offer-service-modal';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { JobApplicationModal } from '@/components/job-application-modal';

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  post_type: 'portfolio_post' | 'hiring_post' | 'service_request' | 'job_seeker_post' | 'social_post';
  job_title?: string | null;
  profession?: string | null;
  category?: string | null;
  city?: string | null;
  experience_level?: string | null;
  location?: string | null;
  availability?: string | null;
  price_type?: string | null;
  price_value?: number | null;
  currency?: string | null;
  created_at: string;
  user: {
    name: string;
    email: string;
    account_type: 'professional' | 'customer';
    avatar_url?: string | null;
  };
};

const DEMO_POSTS: Post[] = [
  {
    id: 'demo-1',
    user_id: '00000000-0000-0000-0000-000000000001',
    text: 'Tražimo iskusnog vodoinstalatera za opremanje novogradnje u Novom Beogradu. Posao uključuje montažu kupatila, kuhinja i instalacionih šahtova. Prednost imaju kandidati sa iskustvom na sličnim projektima.',
    post_type: 'hiring_post',
    job_title: 'Vodoinstalater za novogradnju',
    category: 'Vodoinstalater',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Gradnja Plus d.o.o.', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-2',
    user_id: '00000000-0000-0000-0000-000000000002',
    text: 'Potreban električar za završne radove u stambeno-poslovnom objektu. Ugradnja razvodnih tabli, utičnica, osvetljenja i spoljašnje rasvete. Rad po potrebi i vikendom.',
    post_type: 'hiring_post',
    job_title: 'Elektroinstalatere — stambeni objekat',
    category: 'Elektricar',
    city: 'Novi Sad',
    experience_level: 'Senior',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user: { name: 'InvestBuild NS', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-3',
    user_id: '00000000-0000-0000-0000-000000000003',
    text: 'Tražimo majstora za renoviranje stana 65m² — farbanje, gletovanje, postavljanje pločica u kupatilu i kuhinji. Stan u Zemunu, slobodan odmah.',
    post_type: 'hiring_post',
    job_title: 'Majstor za renoviranje stana',
    category: 'Soboslikar',
    city: 'Beograd',
    experience_level: 'Entry',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Milena Jovanović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-4',
    user_id: '00000000-0000-0000-0000-000000000004',
    text: 'Potrebna kompletna rekonstrukcija krovišta na porodičnoj kući površine 120m². Uključuje zamenu letvi, pokrivanje crepom i ugradnju oluka.',
    post_type: 'service_request',
    job_title: 'Rekonstrukcija krovišta',
    category: 'Krovopokrivač',
    city: 'Kragujevac',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 3500,
    currency: 'EUR',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Dragan Petrović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-5',
    user_id: '00000000-0000-0000-0000-000000000005',
    text: 'Tražim servisera za klimu — čišćenje i punjenje freonom za 3 klima uređaja u poslovnom prostoru. Hitno, za sledeću nedelju.',
    post_type: 'service_request',
    job_title: 'Servis klima uređaja',
    category: 'Klima tehničar',
    city: 'Niš',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 120,
    currency: 'EUR',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Aleksa Stojanović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-6',
    user_id: '00000000-0000-0000-0000-000000000006',
    text: 'Iskusan vodoinstalater sa 8 godina iskustva traži posao. Radim brzo i kvalitetno, dostupan za hitne intervencije. Reference na uvid.',
    post_type: 'job_seeker_post',
    job_title: 'Vodoinstalater — tražim posao',
    category: 'Vodoinstalater',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 1500,
    currency: 'RSD',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Nemanja Ilić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-7',
    user_id: '00000000-0000-0000-0000-000000000007',
    text: 'Majstor za gletovanje i farbanje sa 12 godina iskustva. Radim sva gletovanja — fino, grubo, dekorativna. Savestan i tačan. Dostupan u Beogradu i okolini.',
    post_type: 'job_seeker_post',
    job_title: 'Gletač/farbač — tražim angažman',
    category: 'Soboslikar',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'hourly',
    price_value: 1200,
    currency: 'RSD',
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Zoran Marković', email: 'demo@example.com', account_type: 'professional' },
  },
];

const EXP_LEVEL_KEYS: Record<string, string> = {
  'Entry': 'marketplace.expEntry',
  'Mid': 'marketplace.expMid',
  'Senior': 'marketplace.expSenior',
  'Expert': 'marketplace.expExpert',
};

const AVAIL_KEYS: Record<string, string> = {
  'Immediately': 'marketplace.availImmediately',
  'Within 1 week': 'marketplace.avail1Week',
  'Within 2 weeks': 'marketplace.avail2Weeks',
  'Within 1 month': 'marketplace.avail1Month',
  'Flexible': 'marketplace.availFlexible',
};

function JobsMarketplaceContent() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  usePageTracking('jobs');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hiring');
  const [contactingPostId, setContactingPostId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [categories, setCategories] = useState<string[]>([]);
  const [appliedPosts, setAppliedPosts] = useState<Set<string>>(new Set());
  const [offerServiceModalOpen, setOfferServiceModalOpen] = useState(false);
  const [sendOfferModalOpen, setSendOfferModalOpen] = useState(false);
  const [selectedPostForOffer, setSelectedPostForOffer] = useState<{ id: string; userId: string; userName: string } | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [shareModalPostId, setShareModalPostId] = useState<string | null>(null);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [selectedHiringPost, setSelectedHiringPost] = useState<{ id: string; title: string; ownerId: string } | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPosts();
    loadCategories();
    if (user) {
      fetchSavedJobs();
    } else {
      setSavedSet(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        checkAppliedStatus(postIds);
      }
    };

    const handleFocus = () => {
      if (user && posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        checkAppliedStatus(postIds);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, posts]);

  const fetchSavedJobs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id);
    setSavedSet(new Set((data || []).map((r: any) => r.post_id)));
  };

  const handleSaveJob = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
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

  const checkAppliedStatus = async (postIds: string[]) => {
    if (!user || postIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('post_id')
        .eq('applicant_id', user.id)
        .in('post_id', postIds);

      if (error) { console.error('Error checking applied status:', error); return; }

      setAppliedPosts(new Set((data || []).map((r: any) => r.post_id)));
    } catch (err) {
      console.error('Error in checkAppliedStatus:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPosts = async () => {
    try {
      const { data: postsData, error } = await supabase.rpc('get_posts_with_score', {
        post_types: ['hiring_post', 'service_request', 'job_seeker_post'],
      });

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            text,
            post_type,
            job_title,
            profession,
            category,
            city,
            experience_level,
            location,
            availability,
            price_type,
            price_value,
            currency,
            created_at,
            status,
            user:profiles!posts_user_id_fkey(name, email, account_type, avatar_url)
          `)
          .in('post_type', ['hiring_post', 'service_request', 'job_seeker_post'])
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;

        const postsWithData =
          fallbackData?.map((post: any) => ({
            ...post,
            user: Array.isArray(post.user) ? post.user[0] : post.user,
          })) || [];

        setPosts([...postsWithData, ...DEMO_POSTS]);

        const postIdsToCheck = postsWithData.map((p: any) => p.id);
        if (postIdsToCheck.length > 0) {
          await checkAppliedStatus(postIdsToCheck);
        }

        setLoading(false);
        return;
      }

      const postsWithData =
        postsData?.map((post: any) => ({
          id: post.id,
          user_id: post.user_id,
          text: post.text,
          post_type: post.post_type,
          job_title: post.job_title,
          profession: post.profession,
          category: post.category,
          city: post.city,
          experience_level: post.experience_level,
          location: post.location,
          availability: post.availability,
          price_type: post.price_type,
          price_value: post.price_value,
          currency: post.currency,
          created_at: post.created_at,
          user: post.user_data,
        })) || [];

      setPosts([...postsWithData, ...DEMO_POSTS]);

      const postIdsToCheck = postsWithData.map((p: any) => p.id);
      if (postIdsToCheck.length > 0) {
        await checkAppliedStatus(postIdsToCheck);
      }
    } catch (error: any) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load marketplace posts');
    } finally {
      setLoading(false);
    }
  };

  const getMessageTemplate = (postType: string, postTitle?: string, postId?: string) => {
    switch (postType) {
      case 'hiring_post':
        if (postTitle) {
          const truncatedTitle = postTitle.length > 60 ? postTitle.substring(0, 60) + '...' : postTitle;
          return `Zdravo, prijavljujem se na oglas: "${truncatedTitle}"\n\nMožete li mi dati više detalja?`;
        }
        return t('jobs.templateHiringPost');
      case 'service_request':
        return t('jobs.templateServiceRequest');
      case 'job_seeker_post':
        return t('jobs.templateJobSeekerPost');
      default:
        return '';
    }
  };

  const handleApplyToPost = (postId: string, postTitle?: string, postOwnerId?: string) => {
    if (!user || !profile) {
      toast.error('Morate biti prijavljeni');
      router.push('/login');
      return;
    }
    setSelectedHiringPost({ id: postId, title: postTitle ?? '', ownerId: postOwnerId ?? '' });
    setApplicationModalOpen(true);
  };

  const handleApplicationSuccess = (postId: string) => {
    setAppliedPosts(prev => new Set(prev).add(postId));
  };

  const handleContactUser = async (
    postUserId: string,
    postType?: string,
    useTemplate: boolean = false,
    postTitle?: string,
    postId?: string
  ) => {
    if (!user || !profile) {
      router.push('/login');
      return;
    }

    if (user.id === postUserId) {
      toast.error('You cannot message yourself');
      return;
    }

    setContactingPostId(postUserId);

    try {
      const { threadId, error } = await findOrCreateThread({
        customerId: postUserId,
        proId: user.id,
      });

      if (error) {
        toast.error('Failed to start conversation');
        return;
      }

      if (threadId) {
        const template = useTemplate && postType ? getMessageTemplate(postType, postTitle, postId) : '';
        const url = template
          ? `/messages/${threadId}?template=${encodeURIComponent(template)}`
          : `/messages/${threadId}`;
        router.push(url);
      }
    } catch (err) {
      console.error('Exception in handleContactUser:', err);
      toast.error('An error occurred');
    } finally {
      setContactingPostId(null);
    }
  };

  const handleDeletePost = async () => {
    if (!deleteConfirmPostId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/posts?postId=${deleteConfirmPostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have permission to delete this post');
        } else if (response.status === 404) {
          toast.error('Post not found');
        } else {
          toast.error(data.error || 'Failed to delete post');
        }
        setDeleteConfirmPostId(null);
        return;
      }

      toast.success('Post deleted successfully');
      setPosts((prev) => prev.filter((p) => p.id !== deleteConfirmPostId));
      setDeleteConfirmPostId(null);
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
      setDeleteConfirmPostId(null);
    }
  };

  const resetFilters = () => {
    setCityFilter('');
    setCategoryFilter('');
    setSortOrder('newest');
  };

  const filteredPosts = posts
    .filter((post) => {
      if (activeTab === 'hiring') {
        if (post.post_type !== 'hiring_post') return false;
      } else if (activeTab === 'service-requests') {
        if (post.post_type !== 'service_request') return false;
      } else if (activeTab === 'job-seekers') {
        if (post.post_type !== 'job_seeker_post') return false;
      } else {
        return false;
      }

      if (cityFilter) {
        const postCity = post.city || post.location || '';
        if (!postCity.toLowerCase().includes(cityFilter.toLowerCase())) return false;
      }

      if (categoryFilter && post.category) {
        if (post.category !== categoryFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (activeTab === 'job-seekers' && sortOrder === 'newest') {
        return 0;
      }
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const hiringCount = posts.filter((p) => p.post_type === 'hiring_post').length;
  const serviceRequestCount = posts.filter((p) => p.post_type === 'service_request').length;
  const jobSeekerCount = posts.filter((p) => p.post_type === 'job_seeker_post').length;

  const tabTriggerClass =
  'px-4 py-2.5 text-sm font-medium rounded-xl border border-transparent transition-all duration-200 gap-2 ' +
  'text-muted-foreground hover:text-foreground hover:bg-accent ' +
  'data-[state=active]:bg-orange-500/5 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:border-orange-300 dark:data-[state=active]:border-orange-500/60 data-[state=active]:shadow-sm';

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-8 pb-24">
        <div className="max-w-5xl mx-auto px-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border border-border rounded-2xl shadow-sm">
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-8 pb-24">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('jobs.marketplaceTitle')}</h1>
            <p className="text-slate-600 dark:text-gray-400 mt-2">{t('jobs.marketplaceSubtitle')}</p>
          </div>

          {profile && (
            <Button
              className="bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 text-white shadow-lg transition-colors rounded-xl"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('jobs.createPost')}
            </Button>
          )}
        </div>

        <CreateMarketplacePostModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onPostCreated={loadPosts}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-4 -mx-4 md:mx-0">
            <div className="md:hidden overflow-x-auto overflow-y-hidden border-b border-border">
              <TabsList className="flex flex-nowrap w-max px-4 py-2 gap-2 bg-transparent h-auto">
                <TabsTrigger value="hiring" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <Briefcase className="h-4 w-4" />
                  <span>{t('jobs.hiring')}</span>
                  {hiringCount > 0 && <Badge variant="secondary" className="ml-1">{hiringCount}</Badge>}
                </TabsTrigger>

                <TabsTrigger value="service-requests" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <Users className="h-4 w-4" />
                  <span>{t('jobs.services')}</span>
                  {serviceRequestCount > 0 && <Badge variant="secondary" className="ml-1">{serviceRequestCount}</Badge>}
                </TabsTrigger>

                <TabsTrigger value="job-seekers" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <UserCircle className="h-4 w-4" />
                  <span>{t('jobs.seekers')}</span>
                  {jobSeekerCount > 0 && <Badge variant="secondary" className="ml-1">{jobSeekerCount}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsList className="hidden md:grid w-full px-2 py-2 gap-2 bg-card rounded-2xl grid-cols-3 shadow-sm border border-border">
              <TabsTrigger value="hiring" className={tabTriggerClass}>
                <Briefcase className="h-4 w-4" />
                <span>{t('jobs.hiringPosts')}</span>
                {hiringCount > 0 && <Badge variant="secondary" className="ml-1">{hiringCount}</Badge>}
              </TabsTrigger>

              <TabsTrigger value="service-requests" className={tabTriggerClass}>
                <Users className="h-4 w-4" />
                <span>{t('jobs.serviceRequests')}</span>
                {serviceRequestCount > 0 && <Badge variant="secondary" className="ml-1">{serviceRequestCount}</Badge>}
              </TabsTrigger>

              <TabsTrigger value="job-seekers" className={tabTriggerClass}>
                <UserCircle className="h-4 w-4" />
                <span>{t('jobs.jobSeekers')}</span>
                {jobSeekerCount > 0 && <Badge variant="secondary" className="ml-1">{jobSeekerCount}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <Card className="mt-4 bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
            <CardContent className="pt-6 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterCity')}
                  </label>
                  <CityAutocomplete
                    value={cityFilter}
                    onChange={(city) => setCityFilter(city)}
                    placeholder={t('jobs.filterCityPlaceholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterCategory')}
                  </label>
                  <CategoryCombobox
                    value={categoryFilter}
                    onChange={(value) => setCategoryFilter(value)}
                    suggestions={categories}
                    placeholder={t('jobs.filterCategoryPlaceholder')}
                    filterMode={true}
                    allCategoriesLabel={t('jobs.filterCategoryPlaceholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterSort')}
                  </label>
                  <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t('jobs.sortNewest')}</SelectItem>
                      <SelectItem value="oldest">{t('jobs.sortOldest')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('jobs.resetFilters')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            {filteredPosts.length === 0 ? (
              <Card className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">{t('jobs.noPosts')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const isServiceRequest = post.post_type === 'service_request';

                  return (
                    <Card
                      key={post.id}
                      className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-orange-400/40"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <CardContent className={isServiceRequest ? 'p-5' : 'p-5'}>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Avatar
                                  className="h-9 w-9 cursor-pointer ring-2 ring-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/profile/${post.user_id}`);
                                  }}
                                >
                                  <AvatarImage src={post.user?.avatar_url} alt={post.user?.name} />
                                  <AvatarFallback className="bg-orange-500 text-white text-sm">
                                    {post.user?.name?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <button
                                    className="text-sm font-semibold text-slate-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate block"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/profile/${post.user_id}`);
                                    }}
                                  >
                                    {post.user?.name || 'Unknown User'}
                                  </button>

                                  <p className="text-xs text-slate-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>

                              <h3
                                className={`text-slate-900 dark:text-gray-100 leading-tight line-clamp-2 ${
                                  isServiceRequest ? 'font-semibold text-lg mb-0.5' : 'font-semibold text-base md:text-lg mb-0.5'
                                }`}
                              >
                                {post.job_title || post.category || post.text?.substring(0, 60) || t('jobs.untitledPost')}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {post.post_type === 'hiring_post' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-orange-50 text-orange-600 rounded">
                                    {t('jobs.badgeHiring')}
                                  </span>
                                )}
                                {isServiceRequest && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-blue-50 text-blue-600 rounded">
                                    {t('jobs.badgeServiceRequest')}
                                  </span>
                                )}
                                {post.post_type === 'job_seeker_post' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-green-100 text-green-700 rounded">
                                    {t('jobs.badgeJobSeeker')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShareModalPostId(post.id); }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                                title={t('share.title')}
                              >
                                <Share2 className="h-4 w-4 text-muted-foreground" />
                              </button>

                              {user && (
                                <button
                                  onClick={(e) => handleSaveJob(e, post.id)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                                  title={savedSet.has(post.id) ? t('profile.savedRemove') : t('profile.savedSaveJob')}
                                >
                                  <Bookmark
                                    className={`h-4 w-4 transition-all ${
                                      savedSet.has(post.id) ? 'fill-orange-500 text-orange-500' : 'text-muted-foreground'
                                    }`}
                                  />
                                </button>
                              )}

                              {user?.id === post.user_id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 rounded-lg">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => setDeleteConfirmPostId(post.id)}
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t('jobs.deletePost')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>

                          {/* Hiring post — Option C: icon + label grid */}
                          {post.post_type === 'hiring_post' && (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
                              {post.category && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Briefcase className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelNeeded')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.category}</span>
                                </div>
                              )}
                              {post.city && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelCity')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.city}</span>
                                </div>
                              )}
                              {post.experience_level && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Star className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelLevel')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {EXP_LEVEL_KEYS[post.experience_level] ? t(EXP_LEVEL_KEYS[post.experience_level] as any) : post.experience_level}
                                  </span>
                                </div>
                              )}
                              {post.availability && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelStart')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Job seeker post — Option C */}
                          {post.post_type === 'job_seeker_post' && (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
                              {post.category && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Briefcase className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelNeeded')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.category}</span>
                                </div>
                              )}
                              {post.city && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelCity')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.city}</span>
                                </div>
                              )}
                              {post.experience_level && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Star className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelLevel')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {EXP_LEVEL_KEYS[post.experience_level] ? t(EXP_LEVEL_KEYS[post.experience_level] as any) : post.experience_level}
                                  </span>
                                </div>
                              )}
                              {post.availability && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelAvail')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                  </span>
                                </div>
                              )}
                              {post.price_value && (
                                <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                                  <Star className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelSalary')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100">
                                    {`${post.currency || 'RSD'} ${post.price_value}${post.price_type === 'hourly' ? t('jobs.pricePerHour') : post.price_type === 'fixed' ? ` ${t('jobs.priceFixed')}` : ''}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Service request — keep simple inline style */}
                          {isServiceRequest && (
                            <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-gray-300">
                              {post.category && (
                                <span className="inline-flex items-center gap-1">{post.category}</span>
                              )}
                              {post.city && (
                                <span className="inline-flex items-center gap-1">
                                  {post.category && <span className="text-slate-400">•</span>}
                                  <MapPin className="h-3 w-3" />{post.city}
                                </span>
                              )}
                              {post.availability && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-medium border border-slate-200 dark:border-slate-700">
                                  {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                </span>
                              )}
                            </div>
                          )}

                          {isServiceRequest && post.price_value && (
                            <div className="text-base font-bold text-slate-900 dark:text-gray-200">
                              {`${post.currency || 'EUR'} ${post.price_value}${
                                post.price_type === 'hourly' ? t('jobs.pricePerHour') : post.price_type === 'fixed' ? ` ${t('jobs.priceFixed')}` : ''
                              }`}
                            </div>
                          )}

                          {post.text && (
                            <div>
                              <p className={`text-slate-700 dark:text-gray-300 leading-relaxed ${isServiceRequest ? 'text-sm' : 'text-xs md:text-sm'} ${post.text.length > 120 && !expandedPosts.has(post.id) ? 'line-clamp-2' : ''}`}>
                                {post.text}
                              </p>
                              {post.text.length > 120 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedPosts(prev => { const n = new Set(prev); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; }); }}
                                  className="text-xs text-orange-600 font-semibold mt-0.5 hover:text-orange-500"
                                >
                                  {expandedPosts.has(post.id) ? t('posts.showLess') : t('posts.readMore')}
                                </button>
                              )}
                            </div>
                          )}

                          {isServiceRequest && <div className="border-t border-slate-200 pt-2 mt-2 -mx-4 px-4" />}

                          <div className={`flex gap-2 ${isServiceRequest ? '' : 'pt-0.5'}`}>
                            {!user && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => router.push('/login')}
                                className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm flex-1 rounded-xl"
                              >
                                <Send className="h-3.5 w-3.5 mr-1.5" />
                                {t('jobs.signInToContact')}
                              </Button>
                            )}
                            {user && user?.id !== post.user_id && (
                              <>
                                {post.post_type === 'hiring_post' && (
                                  <div className="flex gap-2 w-full">
                                    {appliedPosts.has(post.id) ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled
                                        className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 cursor-not-allowed h-9 text-xs md:text-sm flex-1 border-green-200 dark:border-green-700 rounded-xl"
                                      >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {t('jobs.applied')}
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleApplyToPost(post.id, post.job_title || post.text || 'oglas', post.user_id);
                                        }}
                                        className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm flex-1 rounded-xl"
                                      >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {t('jobs.applyButton')}
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-xs md:text-sm flex-1 rounded-xl"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}

                                {post.post_type === 'service_request' && (
                                  <div className="flex gap-2 w-full">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedPostForOffer({
                                          id: post.id,
                                          userId: post.user_id,
                                          userName: post.user?.name || 'Unknown',
                                        });
                                        setOfferServiceModalOpen(true);
                                      }}
                                      className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-sm flex-1 rounded-xl"
                                    >
                                      <Send className="h-4 w-4 mr-1.5" />
                                      {t('jobs.offerServiceButton')}
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-sm flex-1 rounded-xl"
                                    >
                                      <MessageCircle className="h-4 w-4 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}

                                {post.post_type === 'job_seeker_post' && (
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedPostForOffer({
                                          id: post.id,
                                          userId: post.user_id,
                                          userName: post.user.name,
                                        });
                                        setSendOfferModalOpen(true);
                                      }}
                                      className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm w-auto rounded-xl"
                                    >
                                      <Send className="h-3.5 w-3.5 mr-1.5" />
                                      {t('jobs.offerJobButton')}
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-xs md:text-sm w-auto rounded-xl"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>
      </div>

      <AlertDialog open={deleteConfirmPostId !== null} onOpenChange={(open) => !open && setDeleteConfirmPostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('jobs.deletePost')}</AlertDialogTitle>
            <AlertDialogDescription>{t('jobs.deletePostConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('jobs.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              {t('jobs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedPostForOffer && (
        <>
          <OfferServiceModal
            open={offerServiceModalOpen}
            onOpenChange={setOfferServiceModalOpen}
            receiverId={selectedPostForOffer.userId}
            receiverName={selectedPostForOffer.userName}
            postId={selectedPostForOffer.id}
          />

          <SendOfferModal
            open={sendOfferModalOpen}
            onOpenChange={setSendOfferModalOpen}
            receiverId={selectedPostForOffer.userId}
            receiverName={selectedPostForOffer.userName}
            postId={selectedPostForOffer.id}
          />
        </>
      )}

      {shareModalPostId && (
        <SharePostModal
          postId={shareModalPostId}
          open={!!shareModalPostId}
          onOpenChange={(open) => { if (!open) setShareModalPostId(null); }}
        />
      )}

      {selectedHiringPost && (
        <JobApplicationModal
          open={applicationModalOpen}
          onOpenChange={setApplicationModalOpen}
          postId={selectedHiringPost.id}
          postTitle={selectedHiringPost.title}
          postOwnerId={selectedHiringPost.ownerId}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* CTA banner for unauthenticated users */}
      {!user && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{t('jobs.ctaBannerTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('jobs.ctaBannerDesc')}</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {t('feed.ctaButton')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function JobsMarketplacePage() {
  return <JobsMarketplaceContent />;
}
