'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { LegacyPostCard } from '@/components/legacy-post-card';
import { EditPostModal } from '@/components/edit-post-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Video, X, Send, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { uploadFile as uploadFileUtil, validateFile } from '@/lib/attachment-utils';
import { SERBIAN_CITIES } from '@/lib/constants';
import { CategoryCombobox } from '@/components/category-combobox';
import { CityAutocomplete } from '@/components/city-autocomplete';

export const revalidate = 0;
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/contexts/language-context';

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  post_type: 'social_post';
  category?: string | null;
  category_normalized?: string | null;
  city?: string | null;
  created_at: string;
  user: {
    name: string;
    email: string;
    account_type: 'professional' | 'customer';
  };
  media: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    order: number;
  }>;
  reactions_count?: number;
  comments_count?: number;
};

function PostsContent() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState<string>('');
  const [postCity, setPostCity] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadPosts();
      loadCategories();
    }
  }, [user]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?post_type=social_post');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    console.log('[Posts] Setting up realtime subscription for user:', user.id, user.email);

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `post_type=eq.social_post`
        },
        async (payload: any) => {
          console.log('=== REALTIME EVENT ===');
          console.log('Event type:', payload.eventType);
          console.log('New record:', payload.new);
          console.log('Old record:', payload.old);
          console.log('=====================');

          if (payload.eventType === 'INSERT') {
            console.log('[Posts] New post detected, reloading posts...');
            await loadPosts();
          } else if (payload.eventType === 'DELETE') {
            console.log('[Posts] Post deleted, removing from list...');
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            console.log('[Posts] Post updated, reloading posts...');
            await loadPosts();
          }
        }
      )
      .subscribe((status: any, err: any) => {
        console.log('[Posts] Subscription status:', status);
        if (err) console.error('[Posts] Subscription error:', err);
        if (status === 'SUBSCRIBED') {
          console.log('[Posts] Successfully subscribed to realtime updates!');
        }
      });

    return () => {
      console.log('[Posts] Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadPosts = async () => {
    try {
      console.log('[LoadPosts] Starting to load posts...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[LoadPosts] Current session user:', session?.user?.id, session?.user?.email);

      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          text,
          post_type,
          category,
          category_normalized,
          city,
          created_at,
          status,
          spam_score,
          rank_penalty,
          phone_count,
          link_count,
          hashtag_count,
          user:profiles!posts_user_id_fkey(name, email, account_type, avatar_url)
        `)
        .eq('post_type', 'social_post')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LoadPosts] Error fetching posts:', error);
        throw error;
      }

      console.log('[LoadPosts] Posts loaded:', postsData?.length || 0);
      console.log('[LoadPosts] Posts IDs:', postsData?.map((p: any) => p.id).join(', '));
      if (postsData && postsData.length > 0) {
        console.log('[LoadPosts] First post:', postsData[0]);
        console.log('[LoadPosts] Last post:', postsData[postsData.length - 1]);
      }

      const postIds = postsData?.map((p: any) => p.id) || [];
      const professionalUserIds = postsData
        ?.filter((p: any) => {
          const userObj = Array.isArray(p.user) ? p.user[0] : p.user;
          return userObj?.account_type === 'professional';
        })
        .map((p: any) => p.user_id) || [];

      let mediaData: any[] = [];
      let reviewsData: any[] = [];

      if (postIds.length > 0) {
        console.log('[LoadPosts] Loading media for posts:', postIds);
        const { data: media, error: mediaError } = await supabase
          .from('post_media')
          .select('*')
          .in('post_id', postIds)
          .order('order', { ascending: true });

        if (mediaError) {
          console.error('[LoadPosts] Error fetching media:', mediaError);
        } else {
          console.log('[LoadPosts] Media loaded:', media?.length || 0);
        }

        mediaData = media || [];
      }

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
          const avgRating = userReviews.reduce((sum: any, r: any) => sum + r.rating, 0) / userReviews.length;
          acc[userId] = {
            average_rating: Math.round(avgRating * 10) / 10,
            review_count: userReviews.length
          };
        }
        return acc;
      }, {});

      const postsWithMedia = postsData?.map((post: any) => {
        const userObj = Array.isArray(post.user) ? post.user[0] : post.user;
        return {
          ...post,
          user: userObj ? {
            ...userObj,
            ...(reviewStats[post.user_id] || {})
          } : null,
          media: mediaData.filter((m: any) => m.post_id === post.id)
        };
      }) || [];

      console.log('[LoadPosts] Final posts with media:', postsWithMedia.length);
      setPosts(postsWithMedia);
    } catch (error: any) {
      console.error('[LoadPosts] Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error || `${file.name} is not valid`);
        continue;
      }
      setSelectedFiles(prev => [...prev, file]);
    }

    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && selectedFiles.length === 0) {
      toast.error('Please add text or media to your post');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to create a post');
      return;
    }

    setUploading(true);

    try {
      console.log('[Posts] Creating post for user:', user.id, user.email);

      // Refresh session to ensure JWT is valid
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        console.error('[Posts] Failed to refresh session:', sessionError);
        toast.error('Session expired. Please log in again.');
        setUploading(false);
        return;
      }

      console.log('[Posts] Session refreshed, auth.uid:', session.user.id);

      // Normalize category if provided
      const normalizeCategory = (cat: string) => {
        return cat.toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/š/g, 's')
          .replace(/č/g, 'c')
          .replace(/ć/g, 'c')
          .replace(/ž/g, 'z');
      };

      // Create social post (available to all users)
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: session.user.id,
          text: postText.trim() || null,
          post_type: 'social_post',
          category: postCategory || null,
          category_normalized: postCategory ? normalizeCategory(postCategory) : null,
          city: postCity || null,
        })
        .select()
        .single();

      if (postError) {
        console.error('[Posts] Error creating post:', postError);
        throw new Error(postError.message || 'Failed to create post');
      }

      console.log('[Posts] Post created successfully:', postData);
      console.log('[Posts] Post ID:', postData.id);
      console.log('[Posts] User ID in post:', postData.user_id);
      console.log('[Posts] Post type:', postData.post_type);

      // Upload media files if any
      if (selectedFiles.length > 0 && postData) {
        console.log('[Posts] Uploading media files for post:', postData.id);
        const mediaItems = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          console.log('[Posts] Uploading file:', file.name, file.type, file.size);
          const uploadResult = await uploadFileUtil(file, session.user.id, undefined, 'post-media');

          if (uploadResult) {
            console.log('[Posts] File uploaded successfully:', uploadResult.url);
            const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
            mediaItems.push({
              post_id: postData.id,
              type: mediaType,
              url: uploadResult.url,
              order: i
            });
          } else {
            console.error('[Posts] Failed to upload file:', file.name);
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        if (mediaItems.length > 0) {
          console.log('[Posts] Saving media items to database:', mediaItems.length);
          const { error: mediaError } = await supabase.from('post_media').insert(mediaItems);

          if (mediaError) {
            console.error('[Posts] Failed to save media:', mediaError);
            toast.error('Failed to save media attachments');
          } else {
            console.log('[Posts] Media saved successfully');
          }
        }
      }

      setPostText('');
      setPostCategory('');
      setPostCity('');
      setSelectedFiles([]);
      toast.success('Post created successfully!');
      loadPosts();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const { data: mediaItems } = await supabase
        .from('post_media')
        .select('url')
        .eq('post_id', postId);

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

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting post:', error);
        toast.error('Failed to delete post');
        return;
      }

      toast.success('Post deleted successfully');
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleEditPost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setEditingPost(post);
      setEditModalOpen(true);
    }
  };

  const handleSaveEdit = async (postId?: string, newText?: string) => {
    if (!user || !postId || !newText) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      console.log('[POSTS PAGE DEBUG] Token:', token);

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/posts/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, text: newText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update post');
      }

      const result = await response.json();

      setPosts(prev =>
        prev.map(p =>
          p.id === postId ? { ...p, ...result.post } : p
        )
      );

      if (result.spam_analysis) {
        const { status, link_count, phone_count } = result.spam_analysis;
        if (status === 'published') {
          toast.success('Post updated and status refreshed successfully!');
        } else if (status === 'shadow_limited') {
          toast.warning('Post updated but still has reduced visibility. Remove more links or phones to fully publish.');
        } else if (status === 'shadow_hidden') {
          toast.warning('Post updated but is still hidden. Reduce links to 8 or less to improve visibility.');
        }
      } else {
        toast.success('Post updated successfully');
      }
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 py-8 pb-24">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-slate-200 shadow-md">
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
    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 py-6 pb-24">
      <div className="max-w-xl mx-auto px-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Feed</h1>
          <p className="text-slate-600 mt-1 text-sm">Share your thoughts, photos, and videos with the community</p>
        </div>

        {/* Search & Filter Bar */}
        <Card className="border-slate-200 shadow-md bg-white">
          <CardContent className="py-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Pretraži postove..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-orange-100 border-orange-300' : ''}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Kategorija</Label>
                  <CategoryCombobox
                    value={filterCategory}
                    onChange={setFilterCategory}
                    suggestions={categories}
                    placeholder="Sve kategorije"
                    filterMode={true}
                    allCategoriesLabel="Sve kategorije"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Grad</Label>
                  <CityAutocomplete
                    value={filterCity}
                    onChange={(city) => setFilterCity(city)}
                    placeholder="Svi gradovi"
                    showAllOption={true}
                  />
                </div>

                <div>
  <Label className="text-xs text-slate-600 mb-1 block">Sortiraj</Label>
  <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'newest' | 'popular')}>
    <SelectTrigger className="!bg-white !text-slate-900 border border-slate-200 dark:!bg-[#0b1220] dark:!text-white dark:border-slate-700">
      <SelectValue placeholder="Najnovije" />
    </SelectTrigger>
    <SelectContent className="bg-white text-slate-900 border border-slate-200 dark:bg-[#0b1220] dark:text-white dark:border-slate-700">
      <SelectItem value="newest">Najnovije</SelectItem>
      <SelectItem value="popular">Najpopularnije</SelectItem>
    </SelectContent>
  </Select>
</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Category Tags */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button
            variant={filterCategory === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('')}
            className={filterCategory === '' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
          >
            Sve
          </Button>
          {categories.slice(0, 8).map((cat) => (
            <Button
              key={cat}
              variant={filterCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategory(cat)}
              className={filterCategory === cat ? 'bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap' : 'whitespace-nowrap'}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Create Post */}
        <Card className="border-slate-200 shadow-lg bg-white">
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-slate-800">Kreiraj Post</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Šta ti je na umu?"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={3}
              className="resize-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Kategorija (opciono)</Label>
                <CategoryCombobox
                  value={postCategory}
                  onChange={setPostCategory}
                  suggestions={categories}
                  placeholder="Izaberi kategoriju"
                  filterMode={false}
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Grad (opciono)</Label>
                <CityAutocomplete
                  value={postCity}
                  onChange={(city) => setPostCity(city)}
                  placeholder="Izaberi grad"
                  showAllOption={false}
                />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={URL.createObjectURL(file)}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={uploading}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Images
                </Button>

                <input
                  type="file"
                  id="video-upload"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('video-upload')?.click()}
                  disabled={uploading}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Video
                </Button>
              </div>

              <Button
                onClick={handleCreatePost}
                disabled={uploading || (!postText.trim() && selectedFiles.length === 0)}
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        {(() => {
          let filteredPosts = posts.filter((post) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery.trim() ||
              post.text?.toLowerCase().includes(query) ||
              post.user?.name?.toLowerCase().includes(query) ||
              post.user?.email?.toLowerCase().includes(query) ||
              post.category?.toLowerCase().includes(query) ||
              post.city?.toLowerCase().includes(query);

            const matchesCategory = !filterCategory ||
              post.category === filterCategory;

            const matchesCity = !filterCity ||
              (post.city && post.city.toLowerCase().includes(filterCity.toLowerCase()));

            return matchesSearch && matchesCategory && matchesCity;
          });

          if (sortBy === 'popular') {
            filteredPosts = filteredPosts.sort((a, b) => {
              const aScore = (a.reactions_count || 0) + (a.comments_count || 0) * 2;
              const bScore = (b.reactions_count || 0) + (b.comments_count || 0) * 2;
              return bScore - aScore;
            });
          }

          return filteredPosts.length === 0 ? (
            <Card className="border-slate-200 shadow-lg bg-white">
              <CardContent className="py-8 text-center">
                <p className="text-slate-500">
                  {searchQuery.trim() || filterCategory || filterCity
                    ? 'Nema postova koji odgovaraju pretrazi.'
                    : 'Nema postova još. Budi prvi koji će postovati!'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <LegacyPostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  currentUserAccountType={profile?.account_type}
                  onDelete={handleDeletePost}
                  onEdit={handleEditPost}
                />
              ))}
            </div>
          );
        })()}

        {editingPost && (
          <EditPostModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            postId={editingPost.id}
            initialText={editingPost.text}
            media={editingPost.media}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </div>
  );
}

export default function PostsPage() {
  return (
    <ProtectedRoute>
      <PostsContent />
    </ProtectedRoute>
  );
}
