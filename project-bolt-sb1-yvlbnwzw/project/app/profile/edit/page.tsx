'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/contexts/language-context';
import { countries } from '@/lib/countries';

function EditProfileContent() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [customCountry, setCustomCountry] = useState('');
  const [category, setCategory] = useState('');
  const [accountType, setAccountType] = useState<'customer' | 'professional'>('customer');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const MAX_BIO_LENGTH = 300;

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setCity(profile.city || '');
      const savedCountry = (profile as any).country || '';
      const isKnown = countries.some((c) => c.value === savedCountry);
      if (isKnown || !savedCountry) {
        setCountry(savedCountry);
        setCustomCountry('');
      } else {
        setCountry('Ostalo');
        setCustomCountry(savedCountry);
      }
      setAccountType((profile.account_type as any) || 'customer');
      setCategory(profile.category || '');
      setBio(profile.bio || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setWebsiteUrl(profile.website_url || '');
      setShowPhone(profile.show_phone ?? true);
      setShowEmail(profile.show_email ?? false);
      setAvatarUrl(profile.avatar_url || '');
      setLoading(false);
    }
  }, [profile]);

  const normalizeWebsiteUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  };

  const isValidEmail = (val: string) =>
    !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

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
          account_type: accountType,
          city: city.trim() || null,
          country: (country === 'Ostalo' ? customCountry.trim() || 'Ostalo' : country.trim()) || null,
          category: category.trim() || null,
          bio: bio.trim() || null,
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
      await refreshProfile();
      router.push('/profile');
    } catch (error: any) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.push('/profile')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('profile.editBackToProfile')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.editPageTitle')}</CardTitle>
            <CardDescription>
              {t('profile.editPageDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label>{t('profile.editAvatar')}</Label>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="h-24 w-24">
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
                        {t('profile.editAvatarUploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {avatarUrl ? t('profile.editAvatarChange') : t('profile.editAvatarUpload')}
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('profile.editAvatarMax')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('profile.editDisplayName')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('profile.editDisplayNamePlaceholder')}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t('profile.editCity')}</Label>
                <CityAutocomplete
                  value={city}
                  onChange={(city) => setCity(city)}
                  placeholder={t('profile.editCityPlaceholder')}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t('profile.editCountry')}</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setCustomCountry(''); }}
                  disabled={saving}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <option value="">{language === 'en' ? 'Select your country' : 'Odaberite državu'}</option>
                  {countries.map((c) => (
                    <option key={c.value} value={c.value}>
                      {language === 'en' ? c.en : c.sr}
                    </option>
                  ))}
                </select>
                {country === 'Ostalo' && (
                  <Input
                    placeholder={language === 'en' ? 'Enter your country' : 'Unesite vašu državu'}
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    disabled={saving}
                    className="h-10"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t('profile.editCategory')}</Label>
                <CategoryCombobox
                  value={category}
                  onChange={setCategory}
                  suggestions={[]}
                  placeholder={t('profile.editCategoryPlaceholder')}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('login.accountTypeLabel')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('customer')}
                    disabled={saving}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      accountType === 'customer'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {t('login.customerLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('professional')}
                    disabled={saving}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      accountType === 'professional'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {t('login.professionalLabel')}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('profile.editPhone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('profile.editPhonePlaceholder')}
                  disabled={saving}
                />
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-medium">{t('profile.editShowPhone')}</p>
                    <p className="text-xs text-muted-foreground">{t('profile.editShowPhoneDesc')}</p>
                  </div>
                  <Switch
                    checked={showPhone}
                    onCheckedChange={setShowPhone}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('profile.editEmail')}</Label>
                <Input
                  id="email"
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
                  <Switch
                    checked={showEmail}
                    onCheckedChange={setShowEmail}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">{t('profile.editWebsite')}</Label>
                <Input
                  id="website"
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={t('profile.editWebsitePlaceholder')}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="bio">{t('profile.editBio')}</Label>
                  <span className={`text-xs ${bio.length > MAX_BIO_LENGTH ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.editBioPlaceholder')}
                  className="min-h-[120px] resize-none"
                  disabled={saving}
                  maxLength={MAX_BIO_LENGTH}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 sm:flex-initial"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('profile.editSaving')}
                    </>
                  ) : (
                    t('profile.editSaveChanges')
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/profile')}
                  disabled={saving}
                >
                  {t('profile.editCancel')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <ProtectedRoute>
      <EditProfileContent />
    </ProtectedRoute>
  );
}
