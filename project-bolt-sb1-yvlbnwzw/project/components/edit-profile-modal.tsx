'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/compress-image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Loader2, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { countries } from '@/lib/countries';

type EditProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  currentProfile: {
    name: string;
    city?: string;
    country?: string;
    bio?: string;
    skills?: string[];
    avatar_url?: string;
    email?: string;
    website_url?: string;
    phone?: string;
    show_phone?: boolean;
    show_email?: boolean;
  };
};

export function EditProfileModal({ open, onOpenChange, onSuccess, currentProfile }: EditProfileModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [name, setName] = useState(currentProfile.name);
  const [city, setCity] = useState(currentProfile.city || '');
  const [country, setCountry] = useState(currentProfile.country || '');
  const [bio, setBio] = useState(currentProfile.bio || '');
  const [skills, setSkills] = useState<string[]>(currentProfile.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [email, setEmail] = useState(currentProfile.email || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentProfile.website_url || '');
  const [phone, setPhone] = useState(currentProfile.phone || '');
  const [showPhone, setShowPhone] = useState(currentProfile.show_phone ?? true);
  const [showEmail, setShowEmail] = useState(currentProfile.show_email ?? false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const MAX_BIO_LENGTH = 300;

  const normalizeWebsiteUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  };

  const isValidEmail = (val: string) =>
    !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  useEffect(() => {
    setName(currentProfile.name);
    setCity(currentProfile.city || '');
    setCountry(currentProfile.country || '');
    setBio(currentProfile.bio || '');
    setSkills(currentProfile.skills || []);
    setAvatarUrl(currentProfile.avatar_url || '');
    setEmail(currentProfile.email || '');
    setWebsiteUrl(currentProfile.website_url || '');
    setPhone(currentProfile.phone || '');
    setShowPhone(currentProfile.show_phone ?? true);
    setShowEmail(currentProfile.show_email ?? false);
  }, [currentProfile, open]);

  const addSkill = () => {
    const trimmedSkill = skillInput.trim();
    if (trimmedSkill && !skills.includes(trimmedSkill)) {
      setSkills([...skills, trimmedSkill]);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingAvatar(true);

    try {
      const compressed = await compressImage(file, 400);
      const fileName = `${user!.id}/${Date.now()}.jpg`;

      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressed, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      toast.success('Avatar uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (bio.length > MAX_BIO_LENGTH) {
      toast.error(`Bio must be ${MAX_BIO_LENGTH} characters or less`);
      return;
    }

    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          city: city.trim() || null,
          country: country || null,
          bio: bio.trim() || null,
          skills: skills,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website_url: normalizeWebsiteUrl(websiteUrl) || null,
          show_phone: showPhone,
          show_email: showEmail,
          avatar_url: avatarUrl || null,
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast.success('Profile updated');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Avatar</Label>
            <div className="mt-2 flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={name} />
                ) : (
                  <AvatarFallback className="bg-blue-600 text-white text-2xl">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <Button
                type="button"
                variant="outline"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar || saving}
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
                  </>
                )}
              </Button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Max 5MB</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="country">{t('profile.editCountry')}</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={saving}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
              >
                <option value="">{t('profile.editCountryPlaceholder')}</option>
                {countries.map((c) => (
                  <option key={c.value} value={c.value}>{language === 'sr' ? c.sr : language === 'de' ? c.de : c.en}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('profile.editCity') || 'Grad'}</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('marketplace.city') || 'Vaš grad'}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-phone">Phone (Optional)</Label>
            <Input
              id="modal-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              disabled={saving}
            />
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">{t('profile.editShowPhone')}</p>
                <p className="text-xs text-muted-foreground">{t('profile.editShowPhoneDesc')}</p>
              </div>
              <Switch checked={showPhone} onCheckedChange={setShowPhone} disabled={saving} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-email">{t('profile.editEmail')} (Optional)</Label>
            <Input
              id="modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.editEmailPlaceholder')}
              disabled={saving}
            />
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">{t('profile.editShowEmail')}</p>
                <p className="text-xs text-muted-foreground">{t('profile.editShowEmailDesc')}</p>
              </div>
              <Switch checked={showEmail} onCheckedChange={setShowEmail} disabled={saving} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-website">{t('profile.editWebsite')} (Optional)</Label>
            <Input
              id="modal-website"
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder={t('profile.editWebsitePlaceholder')}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="bio">Bio</Label>
              <span className={`text-xs ${bio.length > MAX_BIO_LENGTH ? 'text-red-500' : 'text-gray-500'}`}>
                {bio.length}/{MAX_BIO_LENGTH}
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="min-h-[100px] resize-none"
              disabled={saving}
              maxLength={MAX_BIO_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Skills / Services</Label>
            <div className="flex gap-2">
              <Input
                id="skills"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill and press Enter"
                disabled={saving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addSkill}
                disabled={saving || !skillInput.trim()}
              >
                Add
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      disabled={saving}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
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
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
