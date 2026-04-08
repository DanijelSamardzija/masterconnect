'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
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
import { Image as ImageIcon, Video, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { validateImageFile, processImageForUpload, getImageDimensions } from '@/lib/image-utils';

type MarketplacePostModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated?: () => void;
  initialPostType?: 'service_request' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing';
};

export function CreateMarketplacePostModal({ open, onOpenChange, onPostCreated, initialPostType }: MarketplacePostModalProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const isCustomer = profile?.account_type === 'customer';
  const isProfessional = profile?.account_type === 'professional';

  const defaultPostType = initialPostType || (isCustomer ? 'service_request' : 'service_listing');
  const [postType, setPostType] = useState<'service_request' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing'>(defaultPostType);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
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

      if ((postType === 'service_listing' || postType === 'portfolio_post') && file.type.startsWith('image/')) {
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user!.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file);

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
      toast.error('Please enter a title (minimum 20 characters)');
      return;
    }

    if (postType === 'service_request' && title.trim().length < 20) {
      toast.error('Title must be at least 20 characters');
      return;
    }

    if (postType !== 'service_request' && !text.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if ((postType === 'hiring_post' || postType === 'portfolio_post') && !jobTitle.trim()) {
      toast.error('Please enter a job title');
      return;
    }

    if (!category.trim()) {
      toast.error('Please select or enter a category');
      return;
    }

    if (!city.trim()) {
      toast.error('Please enter a city');
      return;
    }

    if (postType === 'service_listing') {
      if (selectedFiles.length === 0) {
        toast.error('Please add at least one image');
        return;
      }
      if (!priceType) {
        toast.error('Please select a price type');
        return;
      }
      if ((priceType === 'fixed' || priceType === 'hourly') && !priceValue.trim()) {
        toast.error('Please enter a price amount');
        return;
      }
    }

    if (postType === 'job_seeker_post' || postType === 'hiring_post') {
      if (!experienceLevel || !availability) {
        toast.error('Please fill in all required fields');
        return;
      }
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    if (isProfessional) {
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
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('post_type', 'service_listing')
          .eq('is_active', true);

        if (count && count >= 2) {
          toast.error(t('marketplace.serviceListingLimitReached'));
          return;
        }
      }
    }

    setIsSubmitting(true);
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      const trimmedCategory = category.trim().replace(/\s+/g, ' ');
      const trimmedCity = city.trim().replace(/\s+/g, ' ');

      const postPayload: any = {
        text: text.trim(),
        post_type: postType,
        category: trimmedCategory,
        city: trimmedCity,
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
        postPayload.job_title = `${trimmedCategory} - ${experienceLevel}`;
        if (expectedSalaryType && expectedSalaryAmount) {
          postPayload.price_type = expectedSalaryType;
          postPayload.price_value = parseFloat(expectedSalaryAmount);
          postPayload.currency = expectedSalaryCurrency;
        }
      }

      if (postType === 'hiring_post' || postType === 'portfolio_post') {
        postPayload.job_title = jobTitle.trim();
      }

      console.log('[Marketplace Post] Getting access token...');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      console.log('[Marketplace Post] POST TOKEN?', !!token, token?.slice(0, 20));
      console.log('[Marketplace Post] FETCH URL', new URL('/api/posts', window.location.href).toString());
      console.log('[Marketplace Post] TOKEN PREFIX', token?.slice(0, 20));

      if (!token) {
        console.error('[Marketplace Post] ❌ No access token in session');
        toast.error('No access token in session. Please log in again.');
        throw new Error('No access token in session');
      }

      console.log('[Marketplace Post] ✓ Token found, creating post via /api/posts with Authorization header...');
      console.log('[Marketplace Post] Token:', token ? token.slice(0, 20) + '...' : 'MISSING');

      const createPostResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      });

      console.log('[Marketplace Post] Response status:', createPostResponse.status);

      if (!createPostResponse.ok) {
        const errorText = await createPostResponse.text();
        console.error(`[Marketplace Post] Post creation failed (${createPostResponse.status}):`, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.debug) {
            console.error('[Marketplace Post] Server debug info:', errorJson.debug);
          }
        } catch (e) {
          // Not JSON, ignore
        }
        toast.error('Failed to create post. Please try again.');
        return;
      }

      const result = await createPostResponse.json();
      const postResult = result.data;

      console.log('[Marketplace Post] Post created:', postResult.id, 'serverDebug:', result.debug);

      if (result.antiSpamDebug) {
        console.log('🔍 ANTI-SPAM DEBUG:', result.antiSpamDebug);
      }

      if (selectedFiles.length > 0 && postResult) {
        const mediaItems = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const url = await uploadFile(file);

          if (url) {
            const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
            mediaItems.push({
              post_id: postResult.id,
              type: mediaType,
              url: url,
              order: i
            });
          }
        }

        if (mediaItems.length > 0) {
          await supabase.from('post_media').insert(mediaItems);
        }
      }

      toast.success('Post created successfully!');

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
            {postType === 'job_seeker_post' ? 'Create Job Seeker Profile' : t('marketplace.createPost')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t('marketplace.postType')}</Label>
            <Select value={postType} onValueChange={(value: any) => setPostType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" sideOffset={4}>
                {isCustomer && (
                  <>
                    <SelectItem value="service_request">{t('marketplace.serviceRequest')}</SelectItem>
                    <SelectItem value="job_seeker_post">{t('marketplace.jobSeekerPost')}</SelectItem>
                  </>
                )}
                {isProfessional && (
                  <>
                    <SelectItem value="service_listing">{t('marketplace.serviceListing')}</SelectItem>
                    <SelectItem value="hiring_post">{t('marketplace.hiringPost')}</SelectItem>
                    <SelectItem value="portfolio_post">{t('marketplace.portfolioPost')}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {postType === 'service_request' && (
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Need plumber to fix bathroom sink leak"
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
                Describe the specific job or project you need (minimum 20 characters)
              </p>
            </div>
          )}

          {postType === 'service_listing' && (
            <div>
              <Label>{t('marketplace.title')} *</Label>
              <Input
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

          {(postType === 'hiring_post' || postType === 'portfolio_post') && (
            <div>
              <Label>{t('marketplace.jobTitle')}</Label>
              <Input
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
            <Label>
              {postType === 'service_request'
                ? 'Description (Optional)'
                : postType === 'job_seeker_post'
                ? 'About You'
                : t('marketplace.description')}
            </Label>
            <Textarea
              placeholder={
                postType === 'service_request'
                  ? 'Add more details about your project (optional but recommended)...'
                  : postType === 'job_seeker_post'
                  ? 'Describe your skills, experience, and what kind of job you are looking for...'
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
                {text.length}/800 characters
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

          <div>
            <Label>{t('marketplace.cityRequired')}</Label>
            <CityAutocomplete
              value={city}
              onChange={(cityValue) => setCity(cityValue)}
              placeholder={t('marketplace.cityRequired')}
            />
          </div>

          {postType === 'service_listing' && (
            <>
              <div>
                <Label>Price Type *</Label>
                <Select value={priceType} onValueChange={setPriceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select price type" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                    <SelectItem value="negotiable">Negotiable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(priceType === 'fixed' || priceType === 'hourly') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{priceType === 'fixed' ? 'Price *' : 'Hourly Rate *'}</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
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
                    <Label>Currency *</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
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

          {(postType === 'job_seeker_post' || postType === 'hiring_post') && (
            <>
              <div>
                <Label>{t('marketplace.experienceLevelRequired')}</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('marketplace.experiencePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Entry">{t('marketplace.entryLevel')}</SelectItem>
                    <SelectItem value="Mid">{t('marketplace.midLevel')}</SelectItem>
                    <SelectItem value="Senior">{t('marketplace.seniorLevel')}</SelectItem>
                    <SelectItem value="Expert">{t('marketplace.expertLevel')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('marketplace.availabilityRequired')}</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('marketplace.availabilityPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Immediately">{t('marketplace.availableImmediately')}</SelectItem>
                    <SelectItem value="Within 1 week">{t('marketplace.within1Week')}</SelectItem>
                    <SelectItem value="Within 2 weeks">{t('marketplace.within2Weeks')}</SelectItem>
                    <SelectItem value="Within 1 month">{t('marketplace.within1Month')}</SelectItem>
                    <SelectItem value="Flexible">{t('marketplace.flexible')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {postType === 'job_seeker_post' && (
            <>
              <div>
                <Label>Expected Salary (Optional)</Label>
                <Select value={expectedSalaryType} onValueChange={setExpectedSalaryType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select salary type" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="fixed">Fixed Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {expectedSalaryType && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
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
                    <Label>Currency</Label>
                    <Select value={expectedSalaryCurrency} onValueChange={setExpectedSalaryCurrency}>
                      <SelectTrigger>
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
                {postType === 'service_listing' ? 'Images (Required, min 1, max 10) *' : t('marketplace.media')}
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
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={selectedFiles.length >= 5}
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
                      disabled={selectedFiles.length >= 5}
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
