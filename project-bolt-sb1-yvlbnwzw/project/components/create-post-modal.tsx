'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, X, Loader2, Send, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFile, validateFile, uploadVideoToCloudinary } from '@/lib/attachment-utils';
import { normalizeImageForFeed } from '@/lib/image-utils';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { Label } from '@/components/ui/label';
import { FlexibleTextOverlayEditor } from '@/components/flexible-text-overlay-editor';

type CreatePostModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type OverlayData = {
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center' | 'right';
  fontSize: number;
};

type MediaFile = {
  file: File;
  preview: string;
  overlay?: OverlayData | null;
};

export function CreatePostModal({ open, onOpenChange, onSuccess }: CreatePostModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [postText, setPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const hashtagInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false);
  const [editingMediaIndex, setEditingMediaIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPickerOpenRef = useRef(false);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handleNativeChange = (e: Event) => {
      isPickerOpenRef.current = false;
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (!files.length) return;
      const newMediaFiles: MediaFile[] = [];
      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.valid) { toast.error(validation.error); }
        else { newMediaFiles.push({ file, preview: URL.createObjectURL(file) }); }
      }
      if (newMediaFiles.length) setMediaFiles(prev => [...prev, ...newMediaFiles]);
      input.value = '';
    };
    input.addEventListener('change', handleNativeChange);
    return () => input.removeEventListener('change', handleNativeChange);
  }, []);

  useEffect(() => {
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

    loadCategories();
  }, []);

  const addHashtag = (value: string) => {
    const tag = value.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '');
    if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
      setHashtags(prev => [...prev, tag]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    setHashtags(prev => prev.filter(h => h !== tag));
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      if (hashtagInput.trim()) addHashtag(hashtagInput);
    } else if (e.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1));
    }
  };

  const resetForm = () => {
    setPostText('');
    mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    setCity('');
    setCategory('');
    setHashtags([]);
    setHashtagInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    isPickerOpenRef.current = false;
    const files = Array.from(e.target.files || []);
    const newMediaFiles: MediaFile[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
      } else {
        newMediaFiles.push({
          file,
          preview: URL.createObjectURL(file)
        });
      }
    }

    setMediaFiles(prev => [...prev, ...newMediaFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(mediaFiles[index].preview);
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= mediaFiles.length) return;

    const newMediaFiles = [...mediaFiles];
    const temp = newMediaFiles[index];
    newMediaFiles[index] = newMediaFiles[newIndex];
    newMediaFiles[newIndex] = temp;
    setMediaFiles(newMediaFiles);
  };

  const validateMediaRules = () => {
    if (mediaFiles.length === 0) return true;

    const hasVideo = mediaFiles.some(m => m.file.type.startsWith('video/'));
    const hasImage = mediaFiles.some(m => m.file.type.startsWith('image/'));

    if (hasVideo && mediaFiles.length > 1) {
      toast.error(t('createPost.errorOneVideoOnly'));
      return false;
    }

    if (hasVideo && hasImage) {
      toast.error(t('createPost.errorMixedMedia'));
      return false;
    }

    return true;
  };

  const handleCreatePost = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!postText.trim() && mediaFiles.length === 0) {
      toast.error(t('createPost.errorNoContent'));
      return;
    }

    if (!validateMediaRules()) return;

    if (isSubmitting) {
      console.warn('[Client] Request already in flight, ignoring duplicate call');
      return;
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Client ${requestId}] Starting post creation...`);
    console.log(`[Client ${requestId}] Current user:`, user ? { id: user.id, email: user.email } : 'NO USER');

    setIsSubmitting(true);
    setUploading(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`[Client ${requestId}] Current session:`, {
        hasSession: !!session,
        expiresAt: session?.expires_at,
        now: Math.floor(Date.now() / 1000)
      });

      if (!session) {
        toast.error(t('createPost.errorSessionExpired'));
        return;
      }

      console.log(`[Client ${requestId}] Getting access token...`);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      console.log(`[Client ${requestId}] POST TOKEN?`, !!token, token?.slice(0, 20));
      console.log(`[Client ${requestId}] FETCH URL`, new URL('/api/posts', window.location.href).toString());
      console.log(`[Client ${requestId}] TOKEN PREFIX`, token?.slice(0, 20));

      if (!token) {
        console.error(`[Client ${requestId}] ❌ No access token in session`);
        toast.error(t('createPost.errorNoToken'));
        throw new Error('No access token in session');
      }

      console.log(`[Client ${requestId}] ✓ Token found, creating post via /api/posts with Authorization header...`);
      console.log(`[Client ${requestId}] Token:`, token ? token.slice(0, 20) + '...' : 'MISSING');

      const createPostResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: postText.trim() || '',
          post_type: 'social_post',
          city: city || null,
          category: category || null,
          hashtags,
        }),
      });

      console.log(`[Client ${requestId}] Response status:`, createPostResponse.status);

      if (!createPostResponse.ok) {
        const errorText = await createPostResponse.text();
        console.error(`[Client ${requestId}] Post creation failed (${createPostResponse.status}):`, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.debug) {
            console.error(`[Client ${requestId}] Server debug info:`, errorJson.debug);
          }
        } catch (e) {
          // Not JSON, ignore
        }
        toast.error(t('createPost.errorPostFailed'));
        return;
      }

      const result = await createPostResponse.json();
      const postData = result.data;

      console.log(`[Client ${requestId}] Post created:`, {
        postId: postData?.id,
        hasMedia: mediaFiles.length > 0,
        serverDebug: result.debug
      });

      if (result.antiSpamDebug) {
        console.log(`[Client ${requestId}] 🔍 ANTI-SPAM DEBUG:`, result.antiSpamDebug);
      }

      if (mediaFiles.length > 0 && postData) {
        console.log(`[Client ${requestId}] Uploading ${mediaFiles.length} media files...`);
        const mediaItems = [];

        for (let i = 0; i < mediaFiles.length; i++) {
          const { file } = mediaFiles[i];
          console.log(`[Client ${requestId}] Uploading file ${i + 1}/${mediaFiles.length}:`, file.name);

          let fileToUpload = file;

          if (file.type.startsWith('image/')) {
            try {
              console.log(`[Client ${requestId}] Normalizing image to 1080x1920...`);
              fileToUpload = await normalizeImageForFeed(file);
              console.log(`[Client ${requestId}] Image normalized successfully`);
            } catch (error) {
              console.error(`[Client ${requestId}] Failed to normalize image:`, error);
              toast.warning(`${t('createPost.warningOriginalImage')}: ${file.name}`);
            }
          }

          const isVideo = file.type.startsWith('video/');
          let uploadResult: { url: string; path?: string } | null = null;

          if (isVideo) {
            uploadResult = await uploadVideoToCloudinary(fileToUpload, 'gigzone/feed');
          } else {
            uploadResult = await uploadFile(fileToUpload, user!.id, undefined, 'post-media');
          }

          if (uploadResult) {
            const mediaType = isVideo ? 'video' : 'image';
            console.log(`[Client ${requestId}] Determined media type:`, {
              fileName: file.name,
              fileType: file.type,
              determinedType: mediaType,
              url: uploadResult.url
            });
            mediaItems.push({
              post_id: postData.id,
              type: mediaType,
              url: uploadResult.url,
              order: i
            });
          } else {
            console.error(`[Client ${requestId}] Failed to upload file:`, file.name);
            toast.error(`${t('createPost.errorUploadFailed')}: ${file.name}`);
          }
        }

        if (mediaItems.length > 0) {
          console.log(`[Client ${requestId}] Saving ${mediaItems.length} media items to database...`);

          const mediaItemsWithOverlay = mediaItems.map((item, index) => {
            const overlay = mediaFiles[index].overlay;
            return {
              ...item,
              overlay_text: overlay?.text || null,
              overlay_color: overlay?.color || null,
              overlay_x: overlay?.x ?? null,
              overlay_y: overlay?.y ?? null,
              overlay_width: overlay?.width ?? null,
              overlay_align: overlay?.align || null,
              overlay_font_size: overlay?.fontSize ?? null,
            };
          });

          console.log(`[Client ${requestId}] Media items to insert:`, mediaItemsWithOverlay.map(m => ({
            type: m.type,
            url: m.url.substring(0, 80),
            order: m.order
          })));

          const { error: mediaError } = await supabase
            .from('post_media')
            .insert(mediaItemsWithOverlay);

          if (mediaError) {
            console.error(`[Client ${requestId}] Failed to save media:`, mediaError);
            toast.error(t('createPost.errorMediaFailed'));
            return;
          } else {
            console.log(`[Client ${requestId}] Media saved successfully`);
          }
        }
      }

      console.log(`[Client ${requestId}] Post creation completed successfully`);
      console.log(`[Client ${requestId}] Created post details:`, {
        id: result.data?.id,
        status: result.data?.status,
        post_type: result.data?.post_type,
        spam_score: result.data?.spam_score,
        rank_penalty: result.data?.rank_penalty
      });

      const statusMsg = result.data?.status === 'shadow_hidden'
        ? t('createPost.successShadowHidden')
        : result.data?.status === 'shadow_limited'
        ? t('createPost.successShadowLimited')
        : t('createPost.successPost');

      toast.success(statusMsg);

      // Show warnings if detected
      if (result.warnings) {
        if (result.warnings.includes('TOO_MANY_LINKS_WARNING')) {
          setTimeout(() => {
            toast.warning(t('warnings.tooManyLinks'), {
              duration: 6000,
            });
          }, 500);
        }
        if (result.warnings.includes('TOO_MANY_PHONES_WARNING')) {
          setTimeout(() => {
            toast.warning(t('warnings.tooManyPhones'), {
              duration: 6000,
            });
          }, 700);
        }
      }

      resetForm();
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error(`[Client ${requestId}] Error creating post:`, error);
      toast.error(t('createPost.errorGeneric'));
    } finally {
      console.log(`[Client ${requestId}] Cleaning up...`);
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open && !overlayEditorOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('createPost.title')}</DialogTitle>
          <DialogDescription>
            {t('createPost.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreatePost} className="space-y-4 py-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="city">{t('createPost.cityLabel')}</Label>
              <CityAutocomplete
                value={city}
                onChange={(value) => setCity(value)}
                placeholder={t('createPost.cityPlaceholder')}
                disabled={uploading}
              />
            </div>

            <div>
              <Label htmlFor="category">{t('createPost.categoryLabel')}</Label>
              <CategoryCombobox
                value={category}
                onChange={(value) => setCategory(value)}
                suggestions={categories}
                placeholder={t('createPost.categoryPlaceholder')}
                disabled={uploading}
              />
            </div>
          </div>

          <Textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
              }
            }}
            placeholder={t('createPost.textPlaceholder')}
            className="min-h-[120px] resize-none"
            disabled={uploading}
          />

          {/* Suggested quick tags */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t('createPost.suggestedTags')}</p>
            <div className="flex flex-wrap gap-2">
              {(['završenposao', 'tražimradnika', 'pohvala', 'reklamacija', 'ponuda'] as const).map(tag => (
                <button
                  key={tag}
                  type="button"
                  disabled={uploading || hashtags.includes(tag)}
                  onClick={() => addHashtag(tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    hashtags.includes(tag)
                      ? 'border-orange-400 bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 opacity-50'
                      : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Hashtag input */}
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('createPost.hashtagsLabel')}
              <span className="text-xs text-muted-foreground font-normal">{t('createPost.hashtagsMax')}</span>
            </Label>
            <div
              className="flex flex-wrap gap-1.5 min-h-[42px] w-full rounded-md border border-input bg-background px-3 py-2 cursor-text"
              onClick={() => hashtagInputRef.current?.focus()}
            >
              {hashtags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-xs font-medium px-2.5 py-0.5"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeHashtag(tag); }}
                    className="hover:text-orange-900 dark:hover:text-orange-200 ml-0.5"
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {hashtags.length < 10 && (
                <input
                  ref={hashtagInputRef}
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={handleHashtagKeyDown}
                  onBlur={() => { if (hashtagInput.trim()) addHashtag(hashtagInput); }}
                  placeholder={hashtags.length === 0 ? t('createPost.hashtagsPlaceholder') : ''}
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled={uploading}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('createPost.hashtagsHint')}</p>
          </div>

          {mediaFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('createPost.mediaPreviewLabel')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {mediaFiles.map((mediaFile, index) => {
                  const isVideo = mediaFile.file.type.startsWith('video/');
                  const isSelected = selectedMediaIndex === index;

                  return (
                    <div key={index} className="space-y-2">
                      <div
                        className="relative border rounded-lg overflow-hidden bg-slate-50 aspect-square group transition-all"
                      >
                        {isVideo ? (
                          <video
                            src={mediaFile.preview}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img
                            src={mediaFile.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}

                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {index + 1}
                        </div>

                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {index > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFile(index, 'left');
                              }}
                              disabled={uploading}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          )}
                          {index < mediaFiles.length - 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFile(index, 'right');
                              }}
                              disabled={uploading}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            disabled={uploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <Button
                          type="button"
                          variant={mediaFile.overlay ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setEditingMediaIndex(index);
                            setOverlayEditorOpen(true);
                          }}
                          className="w-full"
                        >
                          {mediaFile.overlay ? t('createPost.editTextOverlay') : t('createPost.addTextOverlay')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isPickerOpenRef.current = true;
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="gap-2"
            >
              <Image className="h-4 w-4" />
              {t('createPost.addImages')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isPickerOpenRef.current = true;
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              {t('createPost.addVideo')}
            </Button>

            <div className="flex-1" />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('createPost.posting')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('createPost.post')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {overlayEditorOpen && editingMediaIndex !== null && mediaFiles[editingMediaIndex] && (
      <FlexibleTextOverlayEditor
        mediaUrl={mediaFiles[editingMediaIndex].preview}
        mediaType={mediaFiles[editingMediaIndex].file.type.startsWith('video/') ? 'video' : 'image'}
        initialOverlay={mediaFiles[editingMediaIndex].overlay}
        onSave={(overlay) => {
          setMediaFiles(prev => prev.map((f, i) =>
            i === editingMediaIndex ? { ...f, overlay } : f
          ));
          setOverlayEditorOpen(false);
          setEditingMediaIndex(null);
        }}
        onCancel={() => {
          setOverlayEditorOpen(false);
          setEditingMediaIndex(null);
        }}
      />
    )}
  </>
  );
}
