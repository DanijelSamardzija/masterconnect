'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CategoryCombobox } from '@/components/category-combobox';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, Video, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFile as uploadFileUtil, uploadVideoToCloudinary, validateFile } from '@/lib/attachment-utils';

function CreatePostContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState<string>('');
  const [postCity, setPostCity] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

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
      toast.error('Dodaj tekst ili mediju za objavu');
      return;
    }

    if (!user) {
      toast.error('Morate biti prijavljeni da bi kreirali post');
      return;
    }

    setUploading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        console.error('Failed to refresh session:', sessionError);
        toast.error('Sesija je istekla. Molimo prijavite se ponovo.');
        setUploading(false);
        return;
      }

      const normalizeCategory = (cat: string) => {
        return cat.toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/š/g, 's')
          .replace(/č/g, 'c')
          .replace(/ć/g, 'c')
          .replace(/ž/g, 'z');
      };

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
        console.error('Error creating post:', postError);
        throw new Error(postError.message || 'Failed to create post');
      }

      if (selectedFiles.length > 0 && postData) {
        const mediaItems = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const isVideo = !file.type.startsWith('image/');

          let uploadedUrl: string | null = null;

          if (isVideo) {
            // Videos go through Cloudinary for proper streaming support
            const cloudResult = await uploadVideoToCloudinary(file, 'gigzone/posts');
            uploadedUrl = cloudResult?.url ?? null;
          } else {
            const storageResult = await uploadFileUtil(file, session.user.id, undefined, 'post-media');
            uploadedUrl = storageResult?.url ?? null;
          }

          if (uploadedUrl) {
            mediaItems.push({
              post_id: postData.id,
              type: isVideo ? 'video' : 'image',
              url: uploadedUrl,
              order: i,
            });
          } else {
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        if (mediaItems.length > 0) {
          const { error: mediaError } = await supabase.from('post_media').insert(mediaItems);

          if (mediaError) {
            console.error('Failed to save media:', mediaError);
            toast.error('Failed to save media attachments');
          }
        }
      }

      toast.success('Post kreiran uspešno!');
      router.push('/feed');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Greška prilikom kreiranja posta');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="mr-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Kreiraj Post</h1>
        </div>

        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <p className="text-sm text-gray-600">Podeli svoje misli, fotografije i video sa zajednicom</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="post-text">Opis posta</Label>
              <Textarea
                id="post-text"
                placeholder="Šta ti je na umu?"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows={6}
                className="resize-none mt-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Kategorija (opciono)</Label>
                <CategoryCombobox
                  value={postCategory}
                  onChange={setPostCategory}
                  suggestions={categories}
                  placeholder="Izaberi kategoriju"
                  filterMode={false}
                />
              </div>

              <div>
                <Label>Grad (opciono)</Label>
                <CityAutocomplete
                  value={postCity}
                  onChange={(city) => setPostCity(city)}
                  placeholder="Izaberi grad"
                  showAllOption={false}
                />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div>
                <Label className="mb-2 block">Izabrane slike/video ({selectedFiles.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
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
                onClick={() => document.getElementById('image-upload')?.click()}
                disabled={uploading}
                className="flex-1 md:flex-initial"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Dodaj Slike
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
                onClick={() => document.getElementById('video-upload')?.click()}
                disabled={uploading}
                className="flex-1 md:flex-initial"
              >
                <Video className="h-4 w-4 mr-2" />
                Dodaj Video
              </Button>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleCreatePost}
                disabled={uploading || (!postText.trim() && selectedFiles.length === 0)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white shadow-md h-12 text-base font-semibold"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Objavljivanje...
                  </>
                ) : (
                  'Objavi Post'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreatePostPage() {
  return (
    <ProtectedRoute>
      <CreatePostContent />
    </ProtectedRoute>
  );
}
