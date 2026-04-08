'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, X, FileText, Video, User } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
  postOwnerId: string;
  onSuccess: (postId: string) => void;
};

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function JobApplicationModal({ open, onOpenChange, postId, postTitle, postOwnerId, onSuccess }: Props) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  // Form fields — pre-fill from profile
  const [fullName, setFullName]           = useState(profile?.name ?? '');
  const [phone, setPhone]                 = useState(profile?.phone ?? '');
  const [email, setEmail]                 = useState(user?.email ?? '');
  const [city, setCity]                   = useState(profile?.city ?? '');
  const [bio, setBio]                     = useState('');
  const [skills, setSkills]               = useState('');
  const [experience, setExperience]       = useState('');
  const [salaryType, setSalaryType]       = useState('');
  const [salaryAmount, setSalaryAmount]   = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('RSD');

  // File states
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [imageUpload, setImageUpload]     = useState<UploadState>('idle');

  const [cvFile, setCvFile]               = useState<File | null>(null);
  const [cvUpload, setCvUpload]           = useState<UploadState>('idle');

  const [videoFile, setVideoFile]         = useState<File | null>(null);
  const [videoPreview, setVideoPreview]   = useState<string | null>(null);
  const [videoUpload, setVideoUpload]     = useState<UploadState>('idle');

  const [submitting, setSubmitting]       = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef    = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFullName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setEmail(user?.email ?? '');
    setCity(profile?.city ?? '');
    setBio(''); setSkills(''); setExperience('');
    setSalaryType(''); setSalaryAmount(''); setSalaryCurrency('RSD');
    setImageFile(null); setImagePreview(null); setImageUpload('idle');
    setCvFile(null); setCvUpload('idle');
    setVideoFile(null); setVideoPreview(null); setVideoUpload('idle');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (!submitting) { reset(); onOpenChange(false); }
  };

  // ── File helpers ──────────────────────────────────────────────

  const uploadToStorage = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null;
    const ext  = file.name.split('.').pop() ?? 'bin';
    const path = `${user.id}/${folder}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('post-media').upload(path, file);
    if (error) { console.error('Upload error:', error); return null; }
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    return publicUrl;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Samo slike su dozvoljene'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Slika mora biti manja od 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUpload('idle');
    e.target.value = '';
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Samo PDF ili DOC fajlovi'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('CV mora biti manji od 10MB'); return; }
    setCvFile(file);
    setCvUpload('idle');
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Samo video fajlovi su dozvoljeni'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('Video mora biti manji od 50MB'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUpload('idle');
    e.target.value = '';
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!fullName.trim()) { toast.error(t('apply.required') + ': ' + t('apply.fullName')); return; }
    if (!bio.trim())      { toast.error(t('apply.required') + ': ' + t('apply.bio')); return; }
    if (!experience.trim()) { toast.error(t('apply.required') + ': ' + t('apply.experience')); return; }

    setSubmitting(true);

    try {
      // Upload files in parallel
      let imageUrl: string | null = null;
      let cvUrl:    string | null = null;
      let videoUrl: string | null = null;

      const uploads: Promise<void>[] = [];

      if (imageFile) {
        setImageUpload('uploading');
        uploads.push(
          uploadToStorage(imageFile, 'apply-img').then(url => {
            imageUrl = url;
            setImageUpload(url ? 'done' : 'error');
          })
        );
      }

      if (cvFile) {
        setCvUpload('uploading');
        uploads.push(
          uploadToStorage(cvFile, 'apply-cv').then(url => {
            cvUrl = url;
            setCvUpload(url ? 'done' : 'error');
          })
        );
      }

      if (videoFile) {
        setVideoUpload('uploading');
        uploads.push(
          uploadToStorage(videoFile, 'apply-vid').then(url => {
            videoUrl = url;
            setVideoUpload(url ? 'done' : 'error');
          })
        );
      }

      await Promise.all(uploads);

      // Insert application
      const { data: insertedApp, error } = await supabase.from('job_applications').insert({
        post_id:                 postId,
        applicant_id:            user.id,
        full_name:               fullName.trim(),
        phone:                   phone.trim() || null,
        email:                   email.trim() || null,
        city:                    city.trim() || null,
        bio:                     bio.trim(),
        skills:                  skills.trim() || null,
        experience:              experience.trim(),
        expected_salary_type:    salaryType || null,
        expected_salary_value:   salaryAmount ? parseFloat(salaryAmount) : null,
        expected_salary_currency: salaryType ? salaryCurrency : null,
        profile_image_url:       imageUrl,
        cv_url:                  cvUrl,
        cv_file_name:            cvFile?.name ?? null,
        video_url:               videoUrl,
      }).select('id').single();

      if (error) {
        if (error.code === '23505') {
          toast.error(t('apply.alreadyApplied'));
        } else {
          toast.error(t('apply.error'));
          console.error(error);
        }
        return;
      }

      // Create/find thread and send structured application card message to post owner
      if (postOwnerId && postOwnerId !== user.id) {
        try {
          const { threadId } = await findOrCreateThread({
            customerId: postOwnerId,
            proId: user.id,
          });

          if (threadId) {
            const applicationData = {
              applicationId: insertedApp?.id ?? null,
              postOwnerId: postOwnerId,
              applicantName: fullName.trim(),
              phone: phone.trim() || null,
              email: email.trim() || null,
              city: city.trim() || null,
              bio: bio.trim(),
              skills: skills.trim() || null,
              experience: experience.trim(),
              salaryType: salaryType || null,
              salaryAmount: salaryAmount || null,
              salaryCurrency: salaryCurrency,
              imageUrl: imageUrl,
              cvUrl: cvUrl,
              cvFileName: cvFile?.name ?? null,
              videoUrl: videoUrl,
              postTitle: postTitle,
              submittedAt: new Date().toISOString(),
            };

            await supabase.from('messages').insert({
              thread_id: threadId,
              sender_id: user.id,
              receiver_id: postOwnerId,
              text: JSON.stringify(applicationData),
              message_type: 'application',
            });
          }
        } catch (msgErr) {
          console.error('Failed to send application message:', msgErr);
          // Don't block success — application was already saved
        }
      }

      toast.success(t('apply.success'));
      onSuccess(postId);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(t('apply.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const isUploading = imageUpload === 'uploading' || cvUpload === 'uploading' || videoUpload === 'uploading';

  // ── Render ────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold">{t('apply.modalTitle')}</DialogTitle>
          {postTitle && (
            <DialogDescription className="text-sm text-muted-foreground line-clamp-1">
              {postTitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 pb-6 space-y-5">

          {/* ── Personal Info ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('apply.sectionPersonal')}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="app-name">{t('apply.fullName')} *</Label>
              <Input
                id="app-name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={t('apply.fullName')}
                disabled={submitting}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="app-phone">{t('apply.phone')}</Label>
                <Input
                  id="app-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+381 64 123 4567"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="app-email">{t('apply.email')}</Label>
                <Input
                  id="app-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ime@email.com"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-city">{t('apply.city')}</Label>
              <Input
                id="app-city"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Beograd"
                disabled={submitting}
              />
            </div>
          </section>

          {/* ── Professional Info ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('apply.sectionProfessional')}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="app-bio">{t('apply.bio')} *</Label>
              <Textarea
                id="app-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder={t('apply.bioPlaceholder')}
                rows={3}
                className="resize-none"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-skills">{t('apply.skills')}</Label>
              <Input
                id="app-skills"
                value={skills}
                onChange={e => setSkills(e.target.value)}
                placeholder={t('apply.skillsPlaceholder')}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-exp">{t('apply.experience')} *</Label>
              <Textarea
                id="app-exp"
                value={experience}
                onChange={e => setExperience(e.target.value)}
                placeholder={t('apply.experiencePlaceholder')}
                rows={4}
                className="resize-none"
                disabled={submitting}
                required
              />
            </div>
          </section>

          {/* ── Expected Salary (optional) ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('apply.salary')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={salaryType} onValueChange={setSalaryType} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder={t('apply.salaryType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">{t('apply.salaryHourly')}</SelectItem>
                  <SelectItem value="monthly">{t('apply.salaryMonthly')}</SelectItem>
                  <SelectItem value="fixed">{t('apply.salaryFixed')}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder={t('apply.salaryAmount')}
                value={salaryAmount}
                onChange={e => setSalaryAmount(e.target.value)}
                disabled={submitting || !salaryType}
                min="0"
              />

              <Select value={salaryCurrency} onValueChange={setSalaryCurrency} disabled={submitting || !salaryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RSD">RSD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ── Media Uploads ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('apply.sectionMedia')}
            </h3>

            {/* Profile Image */}
            <div className="space-y-1.5">
              <Label>{t('apply.profileImage')}</Label>
              {imagePreview ? (
                <div className="relative w-20 h-20">
                  <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                  {imageUpload === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setImageUpload('idle'); }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors w-full"
                >
                  <User className="h-4 w-4" />
                  {t('apply.uploadImage')}
                </button>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            {/* CV Upload */}
            <div className="space-y-1.5">
              <Label>{t('apply.cv')}</Label>
              {cvFile ? (
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate flex-1">{cvFile.name}</span>
                  {cvUpload === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!submitting && (
                    <button type="button" onClick={() => { setCvFile(null); setCvUpload('idle'); }}>
                      <X className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors w-full"
                >
                  <Upload className="h-4 w-4" />
                  {t('apply.uploadCV')} (PDF, DOC)
                </button>
              )}
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCvChange} />
            </div>

            {/* Video Upload */}
            <div className="space-y-1.5">
              <Label>{t('apply.video')}</Label>
              {videoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <video src={videoPreview} controls className="w-full max-h-48 object-contain bg-black" />
                  {videoUpload === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => { setVideoFile(null); setVideoPreview(null); setVideoUpload('idle'); }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors w-full"
                >
                  <Video className="h-4 w-4" />
                  {t('apply.uploadVideo')} (max 50MB)
                </button>
              )}
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-background pb-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={submitting}
            >
              {t('apply.cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={submitting || isUploading || !fullName.trim() || !bio.trim() || !experience.trim()}
            >
              {(submitting || isUploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting || isUploading ? t('apply.submitting') : t('apply.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
