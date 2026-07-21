'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, ImageIcon, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { uploadFile, deleteFile, extractStoragePathFromUrl, validateFile } from '@/lib/attachment-utils';
import { normalizeImageForFeed } from '@/lib/image-utils';
import { CategoryCombobox } from './category-combobox';
import { CityAutocomplete } from './city-autocomplete';

type PostMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  order: number;
};

type PostType = 'service_request' | 'service_request_post' | 'job_seeker_post' | 'hiring_post' | 'portfolio_post' | 'service_listing';

interface EditPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postType?: PostType;
  initialText: string | null;
  media: PostMedia[];
  initialCategory?: string | null;
  initialCity?: string | null;
  initialExperienceLevel?: string | null;
  initialAvailability?: string | null;
  initialProfession?: string | null;
  initialLocation?: string | null;
  initialJobTitle?: string | null;
  initialPriceType?: string | null;
  initialPriceValue?: number | null;
  initialCurrency?: string | null;
  onSave: (postId?: string, newText?: string) => Promise<void>;
}

export function EditPostModal({
  open,
  onOpenChange,
  postId,
  postType,
  initialText,
  media,
  initialCategory,
  initialCity,
  initialExperienceLevel,
  initialAvailability,
  initialProfession,
  initialLocation,
  initialJobTitle,
  initialPriceType,
  initialPriceValue,
  initialCurrency,
  onSave,
}: EditPostModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [text, setText] = useState(initialText || '');
  const [category, setCategory] = useState(initialCategory || '');
  const [city, setCity] = useState(initialCity || '');
  const [experienceLevel, setExperienceLevel] = useState(initialExperienceLevel || '');
  const [availability, setAvailability] = useState(initialAvailability || '');
  const [profession, setProfession] = useState(initialProfession || '');
  const [location, setLocation] = useState(initialLocation || '');
  const [jobTitle, setJobTitle] = useState(initialJobTitle || '');
  const [priceType, setPriceType] = useState(initialPriceType || '');
  const [priceValue, setPriceValue] = useState(initialPriceValue?.toString() || '');
  const [currency, setCurrency] = useState(initialCurrency || 'RSD');
  const [saving, setSaving] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  // Media editing state
  const [existingMedia, setExistingMedia] = useState<PostMedia[]>(media);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText || '');
      setCategory(initialCategory || '');
      setCity(initialCity || '');
      setExperienceLevel(initialExperienceLevel || '');
      setAvailability(initialAvailability || '');
      setProfession(initialProfession || '');
      setLocation(initialLocation || '');
      setJobTitle(initialJobTitle || '');
      setPriceType(initialPriceType || '');
      setPriceValue(initialPriceValue?.toString() || '');
      setCurrency(initialCurrency || 'RSD');
      setExistingMedia(media);
      setRemovedMediaIds([]);
      newFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setNewFiles([]);

      if (postType) {
        fetch('/api/categories')
          .then(res => res.json())
          .then(data => setCategorySuggestions(data.categories || []))
          .catch(err => console.error('Error fetching categories:', err));
      }
    }
  }, [open, initialText, initialCategory, initialCity, initialExperienceLevel, initialAvailability, initialProfession, initialLocation, initialJobTitle, postType]);

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

  const MAX_MEDIA = 6;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const currentTotal = existingMedia.length + newFiles.length;
    const toAdd: { file: File; preview: string }[] = [];
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) { toast.error(t(validation.error as any)); continue; }
      toAdd.push({ file, preview: URL.createObjectURL(file) });
    }
    setNewFiles(prev => {
      const combined = [...prev, ...toAdd];
      const totalAfter = existingMedia.length + combined.length;
      if (totalAfter > MAX_MEDIA) {
        toast.error(`Maksimalno ${MAX_MEDIA} fajlova po objavi`);
        const allowed = MAX_MEDIA - existingMedia.length;
        return combined.slice(0, Math.max(0, allowed));
      }
      return combined;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExisting = (id: string) => {
    setRemovedMediaIds(prev => [...prev, id]);
    setExistingMedia(prev => prev.filter(m => m.id !== id));
  };

  const removeNew = (index: number) => {
    URL.revokeObjectURL(newFiles[index].preview);
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateMediaRules = () => {
    const allFiles = [...existingMedia.map(m => m.type), ...newFiles.map(f => f.file.type.startsWith('video/') ? 'video' : 'image' as const)];
    const hasVideo = allFiles.includes('video');
    const hasImage = allFiles.includes('image');
    if (hasVideo && allFiles.length > 1) { toast.error('Možete priložiti samo jedan video po objavi'); return false; }
    if (hasVideo && hasImage) { toast.error('Ne možete kombinovati slike i video'); return false; }
    return true;
  };

  const applyMediaChanges = async () => {
    if (!user) return;

    // Delete removed media from DB + storage
    for (const id of removedMediaIds) {
      const item = media.find(m => m.id === id);
      if (item) {
        const path = extractStoragePathFromUrl(item.url, 'post-media');
        if (path) await deleteFile(path, 'post-media');
        await supabase.from('post_media').delete().eq('id', id);
      }
    }

    // Upload and insert new files
    const keptCount = media.filter(m => !removedMediaIds.includes(m.id)).length;
    for (let i = 0; i < newFiles.length; i++) {
      let fileToUpload = newFiles[i].file;
      if (fileToUpload.type.startsWith('image/')) {
        try { fileToUpload = await normalizeImageForFeed(fileToUpload); } catch {}
      }
      const result = await uploadFile(fileToUpload, user.id, undefined, 'post-media');
      if (result) {
        await supabase.from('post_media').insert({
          post_id: postId,
          type: fileToUpload.type.startsWith('image/') ? 'image' : 'video',
          url: result.url,
          order: keptCount + i,
        });
      } else {
        toast.error(`Greška pri otpremanju: ${newFiles[i].file.name}`);
      }
    }

    // Cleanup previews
    newFiles.forEach(f => URL.revokeObjectURL(f.preview));
  };

  const handleSave = async () => {
    if (!text.trim() && media.length === 0) {
      return;
    }

    if (postType) {
      // Category and city are now OPTIONAL (just like in Create Post)
      // No validation required

      if (postType === 'service_request') {
        if (!jobTitle.trim()) {
          toast.error('Please enter a title (minimum 20 characters)');
          return;
        }
        if (jobTitle.trim().length < 20) {
          toast.error('Title must be at least 20 characters');
          return;
        }
      }

      if (postType === 'service_listing') {
        if (!jobTitle.trim()) {
          toast.error('Please enter a specific service name');
          return;
        }
        if (category && jobTitle.trim().toLowerCase() === category.toLowerCase()) {
          toast.error('Service name must be more specific than the category name');
          return;
        }
      }

      if (postType === 'portfolio_post') {
        if (!profession || !experienceLevel || !location || !availability) {
          toast.error('Please fill in all required fields');
          return;
        }
      }

      if (postType === 'job_seeker_post' || postType === 'hiring_post') {
        if (!experienceLevel || !availability) {
          toast.error('Please fill in all required fields');
          return;
        }
      }
    }

    if (!validateMediaRules()) return;

    setSaving(true);
    try {
      if (postType) {
        const updateData: any = {
          text: text.trim(),
        };

        // Only add category if it has a value
        if (category && category.trim().length > 0) {
          updateData.category = category.trim().replace(/\s+/g, ' ');
        }

        // Only add city if it has a value
        if (city && city.trim().length > 0) {
          updateData.city = city.trim();
        }

        if (postType === 'service_request') {
          updateData.job_title = jobTitle.trim();
        }

        if (postType === 'service_listing') {
          updateData.job_title = jobTitle.trim();
          updateData.price_type = priceType;
          if ((priceType === 'fixed' || priceType === 'hourly') && priceValue.trim()) {
            const parsedPrice = parseFloat(priceValue);
            if (isNaN(parsedPrice) || !isFinite(parsedPrice)) {
              toast.error('Please enter a valid price');
              return;
            }
            updateData.price_value = parsedPrice;
            updateData.currency = currency;
          } else {
            updateData.price_value = null;
            updateData.currency = 'RSD';
          }
        }

        if (postType === 'portfolio_post') {
          updateData.profession = profession;
          updateData.experience_level = experienceLevel;
          updateData.location = location;
          updateData.availability = availability;
        }

        if (postType === 'job_seeker_post' || postType === 'hiring_post') {
          updateData.experience_level = experienceLevel;
          updateData.availability = availability;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        console.log('[EDIT MODAL DEBUG] Token:', token);
        console.log('[EDIT MODAL DEBUG] Session:', session);

        if (!token) {
          throw new Error('Not authenticated');
        }

        const headers = {
          'Content-Type': 'application/json',
          'x-access-token': token,
          'Authorization': `Bearer ${token}`,
        };

        // STEP 2: BUILD FULL PAYLOAD
        const minimalPayload: any = {
          postId,
          text: text.trim(),
        };

        if (city?.trim()) minimalPayload.city = city.trim();
        if (category?.trim()) minimalPayload.category = category.trim();

        if (postType === 'service_listing') {
          minimalPayload.job_title = jobTitle.trim();
          minimalPayload.price_type = priceType;
          if ((priceType === 'fixed' || priceType === 'hourly') && priceValue.trim()) {
            minimalPayload.price_value = parseFloat(priceValue);
            minimalPayload.currency = currency;
          } else {
            minimalPayload.price_value = null;
            minimalPayload.currency = currency;
          }
        }

        if (postType === 'service_request') {
          minimalPayload.job_title = jobTitle.trim();
        }

        if (postType === 'portfolio_post') {
          minimalPayload.profession = profession;
          minimalPayload.experience_level = experienceLevel;
          minimalPayload.location = location;
          minimalPayload.availability = availability;
        }

        if (postType === 'job_seeker_post' || postType === 'hiring_post') {
          minimalPayload.experience_level = experienceLevel;
          minimalPayload.availability = availability;
        }

        const response = await fetch('/api/posts/update', {
          method: 'PUT',
          headers,
          body: JSON.stringify(minimalPayload),
        });

        console.log('[EDIT MODAL DEBUG] Response status:', response.status);

        if (!response.ok) {
          const error = await response.json();
          console.error('[EDIT MODAL DEBUG] Error response:', error);
          throw new Error(error.message || error.details || error.error || 'Failed to update post');
        }

        const result = await response.json();
        console.log('[EDIT MODAL DEBUG] Success response:', result);

        // Show appropriate toast based on spam analysis
        if (result.spam_analysis) {
          const { status, link_count, phone_count } = result.spam_analysis;
          if (status === 'published' && (link_count > 0 || phone_count > 0)) {
            toast.success('Post updated and status refreshed successfully!');
          } else if (status === 'shadow_limited') {
            toast.warning('Post updated but has reduced visibility. Remove links or phones to fully publish.');
          } else if (status === 'shadow_hidden') {
            toast.warning('Post updated but is hidden. Reduce links to 8 or less to improve visibility.');
          } else {
            toast.success('Post updated successfully');
          }
        } else {
          toast.success('Post updated successfully');
        }

        await applyMediaChanges();
        await onSave();
        onOpenChange(false);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        console.log('[EDIT MODAL SOCIAL DEBUG] Token:', token);
        console.log('[EDIT MODAL SOCIAL DEBUG] Session:', session);

        if (!token) {
          throw new Error('Not authenticated');
        }

        const headers = {
          'Content-Type': 'application/json',
          'x-access-token': token,
          'Authorization': `Bearer ${token}`,
        };

        console.log('[EDIT MODAL SOCIAL DEBUG] Request headers:', headers);
        console.log('[EDIT MODAL SOCIAL DEBUG] Request body:', { postId, text: text.trim() });

        const response = await fetch('/api/posts/update', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            postId,
            text: text.trim(),
          }),
        });

        console.log('[EDIT MODAL SOCIAL DEBUG] Response status:', response.status);

        if (!response.ok) {
          const error = await response.json();
          console.error('[EDIT MODAL SOCIAL DEBUG] Error response:', error);
          throw new Error(error.message || error.details || error.error || 'Failed to update post');
        }

        const result = await response.json();
        console.log('[EDIT MODAL SOCIAL DEBUG] Success response:', result);

        // Show appropriate toast based on spam analysis
        if (result.spam_analysis) {
          const { status, link_count, phone_count } = result.spam_analysis;
          if (status === 'published' && (link_count > 0 || phone_count > 0)) {
            toast.success('Post updated and status refreshed successfully!');
          } else if (status === 'shadow_limited') {
            toast.warning('Post updated but has reduced visibility. Remove links or phones to fully publish.');
          } else if (status === 'shadow_hidden') {
            toast.warning('Post updated but is hidden. Reduce links to 8 or less to improve visibility.');
          } else {
            toast.success('Post updated successfully');
          }
        } else {
          toast.success('Post updated successfully');
        }

        await applyMediaChanges();
        await onSave();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {postType === 'service_request' && (
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Need plumber to fix bathroom sink leak"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={100}
                disabled={saving}
              />
              <p className="text-xs text-slate-500 mt-1">
                Describe the specific job or project you need (minimum 20 characters)
              </p>
            </div>
          )}

          {postType && (
            <>
              <div>
                <Label>Category *</Label>
                <CategoryCombobox
                  value={category}
                  onChange={setCategory}
                  suggestions={categorySuggestions}
                  placeholder="Select or enter category"
                />
              </div>

              <div>
                <Label>City *</Label>
                <CityAutocomplete
                  value={city}
                  onChange={setCity}
                  placeholder="Enter city"
                />
              </div>
            </>
          )}

          {postType === 'service_listing' && (
            <>
              <div>
                <Label>Service Name *</Label>
                <Input
                  placeholder="e.g., 'Roof Repair', 'Air Conditioning Installation', 'Boiler Servicing'"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a specific service name (not just the category)
                </p>
              </div>

              <div>
                <Label>Price Type *</Label>
                <Select value={priceType} onValueChange={setPriceType} disabled={saving}>
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
                      min="0"
                      step="0.01"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label>Currency *</Label>
                    <Select value={currency} onValueChange={setCurrency} disabled={saving}>
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

          {postType === 'portfolio_post' && (
            <>
              <div>
                <Label>Profession *</Label>
                <Input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Enter profession"
                  disabled={saving}
                />
              </div>

              <div>
                <Label>Experience Level *</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Entry">Entry Level</SelectItem>
                    <SelectItem value="Mid">Mid Level</SelectItem>
                    <SelectItem value="Senior">Senior Level</SelectItem>
                    <SelectItem value="Expert">Expert Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Location *</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location"
                  disabled={saving}
                />
              </div>

              <div>
                <Label>Availability *</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Immediately">Available Immediately</SelectItem>
                    <SelectItem value="Within 1 week">Within 1 week</SelectItem>
                    <SelectItem value="Within 2 weeks">Within 2 weeks</SelectItem>
                    <SelectItem value="Within 1 month">Within 1 month</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(postType === 'job_seeker_post' || postType === 'hiring_post') && (
            <>
              <div>
                <Label>Experience Level *</Label>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Entry">Entry Level</SelectItem>
                    <SelectItem value="Mid">Mid Level</SelectItem>
                    <SelectItem value="Senior">Senior Level</SelectItem>
                    <SelectItem value="Expert">Expert Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Availability *</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Immediately">Available Immediately</SelectItem>
                    <SelectItem value="Within 1 week">Within 1 week</SelectItem>
                    <SelectItem value="Within 2 weeks">Within 2 weeks</SelectItem>
                    <SelectItem value="Within 1 month">Within 1 month</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>
              {postType === 'service_request' ? 'Description (Optional)' : postType ? 'Description *' : ''}
            </Label>
            <Textarea
              placeholder={
                postType === 'service_request'
                  ? 'Add more details about your project (optional but recommended)...'
                  : postType
                  ? 'Describe your request...'
                  : 'What\'s on your mind?'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={saving}
            />
          </div>

          {postType !== 'hiring_post' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Mediji</p>
                <div className="flex gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={saving}
                  />
                  {existingMedia.length + newFiles.length < MAX_MEDIA && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={saving}
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                        fileInputRef.current.accept = 'image/*,video/*';
                      }
                    }}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Slika
                  </Button>
                  )}
                  {existingMedia.length + newFiles.length < MAX_MEDIA && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={saving}
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'video/*';
                        fileInputRef.current.click();
                        fileInputRef.current.accept = 'image/*,video/*';
                      }
                    }}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Video
                  </Button>
                  )}
                </div>
              </div>

              {(existingMedia.length > 0 || newFiles.length > 0) && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Existing media */}
                  {existingMedia.map((item) => (
                    <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      {item.type === 'image' ? (
                        <Image fill src={item.url} alt="Media" className="object-cover" sizes="(max-width: 640px) calc(33vw - 16px), 150px" />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" muted />
                      )}
                      <button
                        type="button"
                        onClick={() => removeExisting(item.id)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* New files preview */}
                  {newFiles.map((nf, i) => (
                    <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100 ring-2 ring-orange-400/60">
                      {nf.file.type.startsWith('image/') ? (
                        <img src={nf.preview} alt="New" className="w-full h-full object-cover" />
                      ) : (
                        <video src={nf.preview} className="w-full h-full object-cover" muted />
                      )}
                      <div className="absolute left-1 top-1 rounded bg-orange-500 px-1 py-0.5 text-[10px] font-semibold text-white">
                        novo
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNew(i)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
