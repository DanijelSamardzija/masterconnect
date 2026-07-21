'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { compressImage } from '@/lib/utils/compress-image';
import { useLanguage } from '@/lib/contexts/language-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { ImageCropModal } from '@/components/image-crop-modal';
import { Image as ImageIcon, Video, X, Loader2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { validateImageFile, processImageForUpload, getImageDimensions } from '@/lib/image-utils';
import { uploadVideoToCloudinary } from '@/lib/attachment-utils';
import { countries } from '@/lib/countries';
import { devLog } from '@/lib/dev-log';

type PostType = 'service_request' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing';

type MarketplacePostModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated?: () => void;
  initialPostType?: PostType;
  allowedTypes?: PostType[];
};

export function CreateMarketplacePostModal({ open, onOpenChange, onPostCreated, initialPostType, allowedTypes }: MarketplacePostModalProps) {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const defaultPostType = initialPostType || (allowedTypes?.[0]) || 'service_listing';
  const [postType, setPostType] = useState<'service_request' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing'>(defaultPostType);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobSeekerTitle, setJobSeekerTitle] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(profile?.country || '');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [availability, setAvailability] = useState('');
  const [priceType, setPriceType] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [currency, setCurrency] = useState('RSD');
  const [expectedSalaryType, setExpectedSalaryType] = useState('');
  const [expectedSalaryAmount, setExpectedSalaryAmount] = useState('');
  const [expectedSalaryCurrency, setExpectedSalaryCurrency] = useState('RSD');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

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

    if (open) {
      loadCategories();
    }
  }, [open]);

  useEffect(() => {
    if (open && initialPostType) {
      setPostType(initialPostType);
    }
  }, [open, initialPostType]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a valid image or video`);
        continue;
      }

      if (file.type.startsWith('image/')) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          toast.error(validation.error || 'Invalid image file');
          continue;
        }
      } else if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      if (selectedFiles.length >= 10) {
        toast.error('Maximum 10 files allowed');
        break;
      }

      if (postType === 'portfolio_post' && file.type.startsWith('image/')) {
        try {
          const processedFile = await processImageForUpload(file, true);
          const imageUrl = URL.createObjectURL(processedFile);
          setImageToCrop(imageUrl);
          setPendingCropFile(processedFile);
          setCropModalOpen(true);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to process image');
        }
      } else {
        setSelectedFiles(prev => [...prev, file]);
      }
    }

    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    setSelectedFiles(prev => [...prev, croppedFile]);
    setPendingCropFile(null);
    setImageToCrop(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressImage(file, 1200);
      const filePath = `${user!.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, compressed, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (isSubmitting) {
      console.warn('[Client] Request already in flight, ignoring duplicate call');
      return;
    }

    if (postType === 'service_listing' && !title.trim()) {
      toast.error(t('marketplace.titleRequired'));
      return;
    }

    if (postType === 'service_listing' && category && title.trim().toLowerCase() === category.toLowerCase()) {
      toast.error(t('marketplace.titleTooGeneric'));
      return;
    }

    if (postType === 'service_request' && !title.trim()) {
      toast.error(t('marketplace.serviceRequestTitleEnter'));
      return;
    }

    if (postType === 'service_request' && title.trim().length < 20) {
      toast.error(t('marketplace.serviceRequestTitleMin'));
      return;
    }

    if (postType === 'job_seeker_post' && !jobSeekerTitle.trim()) {
      toast.error(t('marketplace.jobSeekerTitle').replace(' *', ''));
      return;
    }

    if (postType !== 'service_request' && !text.trim()) {
      toast.error(t('marketplace.descriptionRequired'));
      return;
    }

    if ((postType === 'hiring_post' || postType === 'portfolio_post') && !jobTitle.trim()) {
      toast.error(t('marketplace.jobTitleRequired'));
      return;
    }

    if (!category.trim()) {
      toast.error(t('marketplace.selectCategory'));
      return;
    }

    if (!city.trim()) {
      toast.error(t('marketplace.enterCity'));
      return;
    }

    if (postType === 'service_listing') {
      if (selectedFiles.length < 3) {
        toast.error(t('marketplace.imagesMinError'));
        return;
      }
      if (!priceType) {
        toast.error(t('marketplace.priceTypeSelect2'));
        return;
      }
      if ((priceType === 'fixed' || priceType === 'hourly') && !priceValue.trim()) {
        toast.error(t('marketplace.priceRequired'));
        return;
      }
    }

    if (postType === 'job_seeker_post' || postType === 'hiring_post') {
      if (!experienceLevel || !availability) {
        toast.error(t('marketplace.allFieldsRequired'));
        return;
      }
    }

    if (!user) {
      toast.error(t('marketplace.mustBeLoggedIn'));
      return;
    }

    if (postType === 'portfolio_post') {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('post_type', 'portfolio_post')
        .eq('is_active', true);

      if (count && count >= 1) {
        toast.error(t('marketplace.portfolioLimitReached'));
        return;
      }
    }

    if (postType === 'service_listing') {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('post_type', 'service_listing')
        .neq('status', 'deleted');

      if ((count ?? 0) >= 2) {
        toast.error(t('marketplace.serviceListingLimitReached'));
        return;
      }
    }

    setIsSubmitting(true);
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error(t('marketplace.sessionExpired'));
        return;
      }

      const trimmedCategory = category.trim().replace(/\s+/g, ' ');
      const trimmedCity = city.trim().replace(/\s+/g, ' ');

      const postPayload: any = {
        text: text.trim(),
        post_type: postType,
        category: trimmedCategory,
        city: trimmedCity,
        country: country || undefined,
        title: title.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
      };

      if (postType === 'service_listing') {
        postPayload.job_title = title.trim();
        postPayload.price_type = priceType;
        if ((priceType === 'fixed' || priceType === 'hourly') && priceValue.trim()) {
          postPayload.price_value = parseFloat(priceValue);
          postPayload.currency = currency;
        }
      }

      if (postType === 'service_request') {
        postPayload.job_title = title.trim();
      }

      if (postType === 'job_seeker_post' || postType === 'hiring_post') {
        postPayload.experience_level = experienceLevel;
        postPayload.availability = availability;
      }

      if (postType === 'job_seeker_post') {
        postPayload.job_title = jobSeekerTitle.trim();
        if (expectedSalaryType && expectedSalaryAmount) {
          postPayload.price_type = expectedSalaryType;
          postPayload.price_value = parseFloat(expectedSalaryAmount);
          postPayload.currency = expectedSalaryCurrency;
        }
      }

      if (postType === 'hiring_post' || postType === 'portfolio_post') {
        postPayload.job_title = jobTitle.trim();
      }

      devLog('[Marketplace Post] Getting access token...');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      devLog('[Marketplace Post] POST TOKEN?', !!token, token?.slice(0, 20));
      devLog('[Marketplace Post] FETCH URL', new URL('/api/posts', window.location.href).toString());
      devLog('[Marketplace Post] TOKEN PREFIX', token?.slice(0, 20));

      if (!token) {
        console.error('[Marketplace Post] ❌ No access token in session');
        toast.error(t('marketplace.sessionExpired'));
        throw new Error('No access token in session');
      }

      devLog('[Marketplace Post] ✓ Token found, creating post via /api/posts with Authorization header...');
      devLog('[Marketplace Post] Token:', token ? token.slice(0, 20) + '...' : 'MISSING');

      const createPostResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      });

      devLog('[Marketplace Post] Response status:', createPostResponse.status);

      if (!createPostResponse.ok) {
        const errorText = await createPostResponse.text();
        console.error(`[Marketplace Post] Post creation failed (${createPostResponse.status}):`, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.debug) {
            console.error('[Marketplace Post] Server debug info:', errorJson.debug);
          }
          if (createPostResponse.status === 429 && errorJson.error === 'SERVICE_LISTING_LIMIT') {
            toast.error(t('marketplace.serviceListingLimitReached'));
            return;
          }
        } catch (e) {
          // Not JSON, ignore
        }
        toast.error(t('marketplace.createFailed'));
        return;
      }

      const result = await createPostResponse.json();
      const postResult = result.data;

      devLog('[Marketplace Post] Post created:', postResult.id, 'serverDebug:', result.debug);

      if (result.antiSpamDebug) {
        devLog('🔍 ANTI-SPAM DEBUG:', result.antiSpamDebug);
      }

      if (selectedFiles.length > 0 && postResult) {
        const mediaItems = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const isVideo = file.type.startsWith('video/');
          let url: string | null = null;

          if (isVideo) {
            const result = await uploadVideoToCloudinary(file, 'gigzone/services', user!.id);
            url = result?.url ?? null;
          } else {
            url = await uploadFile(file);
          }

          if (url) {
            const mediaType = isVideo ? 'video' : 'image';
            mediaItems.push({
              post_id: postResult.id,
              type: mediaType,
              url: url,
              order: i
            });
          }
        }

        if (mediaItems.length > 10) {
          toast.error(t('marketplace.serviceListingLimitReached'));
          return;
        }

        if (mediaItems.length > 0) {
          await supabase.from('post_media').insert(mediaItems);
        } else if (postType === 'service_listing') {
          // All image uploads failed — roll back the post so it doesn't appear without images
          await supabase.from('posts').delete().eq('id', postResult.id);
          toast.error(t('marketplace.imagesUploadFailed') || 'Greška pri otpremanju slika. Pokušajte ponovo.');
          return;
        }
      }

      toast.success(t('marketplace.postCreated'));

      // Onboarding rewards for first service or first job
      const rewardType = postType === 'service_listing' ? 'first_service'
        : postType === 'hiring_post' ? 'first_job'
        : null;
      if (rewardType && postResult) {
        try {
          const { data: rewardEarned } = await supabase.rpc('earn_reward', {
            p_user_id: user!.id,
            p_reward_type: rewardType,
          });
          if (rewardEarned && rewardEarned > 0) {
            setTimeout(() => {
              toast.success(`🪙 +${rewardEarned} ${t('credits.unit')} ${t('credits.reward.earned')}`, { duration: 4000 });
            }, 600);
          }
        } catch { /* silent */ }
      }

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

      setText('');
      setTitle('');
      setJobTitle('');
      setJobSeekerTitle('');
      setCategory('');
      setCity('');
      setExperienceLevel('');
      setAvailability('');
      setPriceType('');
      setPriceValue('');
      setExpectedSalaryType('');
      setExpectedSalaryAmount('');
      setExpectedSalaryCurrency('RSD');
      setSelectedFiles([]);
      onOpenChange(false);
      onPostCreated?.();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {postType === 'job_seeker_post' ? t('marketplace.jobSeekerPost') : t('marketplace.createPost')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {postType === 'service_listing' && (
            <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl p-3">
              <Lightbulb className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-orange-800 dark:text-orange-300">
                  <strong>{t('marketplace.proTipTitle')}</strong> {t('marketplace.proTipText')}{' '}
                  <a
                    href="/profile/edit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:text-orange-600"
                  >
                    {t('marketplace.proTipCta')}
                  </a>
                </p>
              </div>
            </div>
          )}

          <div>
            <Label>{t('marketplace.postType')}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {(
                [
                  { value: 'service_listing', label: t('marketplace.serviceListing') },
                  { value: 'hiring_post', label: t('marketplace.hiringPost') },
                  { value: 'job_seeker_post', label: t('marketplace.jobSeekerPost') },
                  { value: 'service_request', label: t('marketplace.serviceRequest') },
                  { value: 'portfolio_post', label: t('marketplace.portfolioPost') },
                ] as const
              )
                .filter(({ value }) => !allowedTypes || allowedTypes.includes(value))
                .map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPostType(value)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      postType === value
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </div>

          {postType === 'service_request' && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              🔍 <strong>Tražim uslugu</strong> — objavi šta ti treba (npr. "Trebam molera za stan 60m²") i čekaj ponude od profesionalaca.
            </p>
          )}
          {postType === 'job_seeker_post' && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              👤 <strong>{t('marketplace.jobSeekerPost')}</strong> — {t('marketplace.jobSeekerHint')}
            </p>
          )}

          {postType === 'service_request' && (
            <div>
              <Label htmlFor="mp-sr-title">{t('marketplace.serviceRequestTitle')}</Label>
              <Input
                id="mp-sr-title"
                placeholder={t('marketplace.serviceRequestTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                maxLength={100}
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('marketplace.serviceRequestTitleHint')}
              </p>
            </div>
          )}

          {postType === 'service_listing' && (
            <div>
              <Label htmlFor="mp-sl-title">{t('marketplace.title')} *</Label>
              <Input
                id="mp-sl-title"
                placeholder={t('marketplace.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('marketplace.titleHint')}
              </p>
            </div>
          )}

          {postType === 'job_seeker_post' && (
            <div>
              <Label htmlFor="mp-js-title">{t('marketplace.jobSeekerTitle')}</Label>
              <Input
                id="mp-js-title"
                placeholder={t('marketplace.jobSeekerTitlePlaceholder')}
                value={jobSeekerTitle}
                onChange={(e) => setJobSeekerTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                maxLength={100}
              />
              <p className="text-xs text-slate-500 mt-1">{t('marketplace.jobSeekerTitleHint')}</p>
            </div>
          )}

          {(postType === 'hiring_post' || postType === 'portfolio_post') && (
            <div>
              <Label htmlFor="mp-job-title">{t('marketplace.jobTitle')}</Label>
              <Input
                id="mp-job-title"
                placeholder={t('marketplace.jobTitlePlaceholder')}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          )}

          <div>
            <Label htmlFor="mp-description">
              {postType === 'service_request'
                ? t('marketplace.descriptionOptional')
                : postType === 'job_seeker_post'
                ? t('marketplace.aboutYou')
                : t('marketplace.description')}
            </Label>
            <Textarea
              id="mp-description"
              placeholder={
                postType === 'service_request'
                  ? t('marketplace.descriptionOptionalPlaceholder')
                  : postType === 'job_seeker_post'
                  ? t('marketplace.aboutYouPlaceholder')
                  : postType === 'hiring_post'
                  ? t('marketplace.descPlaceholderHiring')
                  : postType === 'service_listing'
                  ? t('marketplace.descPlaceholderListing')
                  : t('marketplace.descPlaceholderSkills')
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                }
              }}
              rows={5}
              maxLength={postType === 'job_seeker_post' ? 800 : undefined}
              className="resize-none"
            />
            {postType === 'job_seeker_post' && (
              <p className="text-xs text-slate-500 mt-1">
                {text.length}/800 {t('marketplace.characters')}
              </p>
            )}
          </div>

          <div>
            <Label>{t('marketplace.categoryRequired')}</Label>
            <CategoryCombobox
              value={category}
              onChange={setCategory}
              suggestions={categories}
              placeholder={t('jobs.selectOrTypeCategory')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mp-country">{t('marketplace.country')}</Label>
              <select
                id="mp-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-1"
              >
                <option value="">{t('marketplace.countryPlaceholder')}</option>
                {countries.map((c) => (
                  <option key={c.value} value={c.value}>{language === 'sr' ? c.sr : language === 'de' ? c.de : c.en}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('marketplace.cityRequired')}</Label>
              <CityAutocomplete
                value={city}
                onChange={(cityValue) => setCity(cityValue)}
                placeholder={t('marketplace.city')}
              />
            </div>
          </div>

          {postType === 'service_listing' && (
            <>
              <div>
                <Label>{t('marketplace.priceTypeRequired')}</Label>
                <div className="flex gap-2 mt-1.5">
                  {(['fixed', 'hourly', 'negotiable'] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPriceType(pt)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        priceType === pt
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-400'
                      }`}
                    >
                      {pt === 'fixed' ? t('marketplace.fixed') : pt === 'hourly' ? t('marketplace.hourly') : t('marketplace.negotiable')}
                    </button>
                  ))}
                </div>
              </div>

              {(priceType === 'fixed' || priceType === 'hourly') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mp-price-value">{priceType === 'fixed' ? t('marketplace.priceFixedLabel') : t('marketplace.priceHourlyLabel')}</Label>
                    <Input
                      id="mp-price-value"
                      type="number"
                      placeholder={t('marketplace.enterAmount')}
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>{t('marketplace.currencyRequired')}</Label>
                    <div className="flex gap-1.5 mt-1.5">
                      {(['RSD', 'EUR', 'USD'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            currency === c
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {(postType === 'job_seeker_post' || postType === 'hiring_post') && (
            <>
              <div>
                <Label htmlFor="mp-experience">{t('marketplace.experienceLevelRequired')}</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger id="mp-experience">
                    <SelectValue placeholder={t('marketplace.experiencePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Entry">{t('marketplace.expEntry')}</SelectItem>
                    <SelectItem value="Mid">{t('marketplace.expMid')}</SelectItem>
                    <SelectItem value="Senior">{t('marketplace.expSenior')}</SelectItem>
                    <SelectItem value="Expert">{t('marketplace.expExpert')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mp-availability">
                  {postType === 'hiring_post' ? t('marketplace.hiringAvailability') : t('marketplace.availabilityRequired')}
                </Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger id="mp-availability">
                    <SelectValue placeholder={
                      postType === 'hiring_post' ? t('marketplace.hiringAvailabilityPlaceholder') : t('marketplace.availabilityPlaceholder')
                    } />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Immediately">{postType === 'hiring_post' ? t('marketplace.hiringImmediately') : t('marketplace.availableImmediately')}</SelectItem>
                    <SelectItem value="Within 1 week">{postType === 'hiring_post' ? t('marketplace.hiringWithin1Week') : t('marketplace.within1Week')}</SelectItem>
                    <SelectItem value="Within 2 weeks">{postType === 'hiring_post' ? t('marketplace.hiringWithin2Weeks') : t('marketplace.within2Weeks')}</SelectItem>
                    <SelectItem value="Within 1 month">{postType === 'hiring_post' ? t('marketplace.hiringWithin1Month') : t('marketplace.within1Month')}</SelectItem>
                    <SelectItem value="Flexible">{postType === 'hiring_post' ? t('marketplace.hiringFlexible') : t('marketplace.flexible')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {postType === 'job_seeker_post' && (
            <>
              <div>
                <Label htmlFor="mp-salary-type">{t('marketplace.expectedSalary')}</Label>
                <Select value={expectedSalaryType} onValueChange={setExpectedSalaryType}>
                  <SelectTrigger id="mp-salary-type">
                    <SelectValue placeholder={t('marketplace.salaryTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="hourly">{t('marketplace.salaryHourly')}</SelectItem>
                    <SelectItem value="monthly">{t('marketplace.salaryMonthly')}</SelectItem>
                    <SelectItem value="fixed">{t('marketplace.salaryFixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {expectedSalaryType && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mp-salary-amount">{t('marketplace.amount')}</Label>
                    <Input
                      id="mp-salary-amount"
                      type="number"
                      placeholder={t('marketplace.enterAmount')}
                      value={expectedSalaryAmount}
                      onChange={(e) => setExpectedSalaryAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mp-salary-currency">{t('marketplace.currency')}</Label>
                    <Select value={expectedSalaryCurrency} onValueChange={setExpectedSalaryCurrency}>
                      <SelectTrigger id="mp-salary-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" align="start" sideOffset={4}>
                        <SelectItem value="RSD">RSD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}

          {postType !== 'service_request' && postType !== 'job_seeker_post' && postType !== 'hiring_post' && (
            <div>
              <Label>
                {postType === 'service_listing' ? t('marketplace.imagesRequired') : t('marketplace.media')}
              </Label>
              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Preview"
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <video
                          src={URL.createObjectURL(file)}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  id="marketplace-image-upload"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={selectedFiles.length >= 10}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.getElementById('marketplace-image-upload')?.click();
                  }}
                  disabled={uploading || selectedFiles.length >= 10}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {t('marketplace.addImages')}
                </Button>

                {postType !== 'service_listing' && (
                  <>
                    <input
                      type="file"
                      id="marketplace-video-upload"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={selectedFiles.length >= 10}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('marketplace-video-upload')?.click();
                      }}
                      disabled={uploading || selectedFiles.length >= 10}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      {t('marketplace.addVideo')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}


          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('marketplace.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('marketplace.creating')}
                </>
              ) : (
                t('marketplace.createButton')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>

      {imageToCrop && (
        <ImageCropModal
          open={cropModalOpen}
          onOpenChange={setCropModalOpen}
          imageUrl={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={(postType === 'service_listing' || postType === 'portfolio_post') ? 1 : 4/3}
        />
      )}
    </Dialog>
  );
}
