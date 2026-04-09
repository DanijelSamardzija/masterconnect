'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { useLanguage } from '@/lib/contexts/language-context';
import { ProtectedRoute } from '@/components/protected-route';
import { DeleteAccountModal } from '@/components/delete-account-modal';
import { ContactSupportModal } from '@/components/contact-support-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ArrowLeft, Settings, Trash2, Lock, Eye, EyeOff,
  Volume2, Mail, Moon, Sun, FileText, Download,
  ExternalLink, Scale, Globe, ChevronRight, Smartphone, UserX, UserCheck, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Switch } from '@/components/ui/switch';
import { useSoundPreference } from '@/hooks/use-sound-preference';
import { useTheme } from '@/hooks/use-theme';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

function SettingsContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  usePageTracking('settings');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [contactSupportModalOpen, setContactSupportModalOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const { notificationsSoundEnabled, messagesSoundEnabled, toggleNotificationsSound, toggleMessagesSound } = useSoundPreference();
  const { theme, toggleTheme, mounted } = useTheme();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsAppInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    try { localStorage.removeItem('pwa_install_dismissed_v2'); } catch {}
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      toast.info(language === 'sr'
        ? 'Otvorite meni browsera (⋮) i izaberite "Dodaj na početni ekran"'
        : 'Open browser menu (⋮) and select "Add to Home Screen"',
        { duration: 6000 }
      );
    }
  };

  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_user_id: string; created_at: string; blocked_user: { id: string; name: string } | null }[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const res = await fetch('/api/block/list', {
        headers: { Authorization: `Bearer ${session.session.access_token}` }
      });
      const json = await res.json();
      setBlockedUsers(json.data || []);
    } catch (e) {
      console.error('Error fetching blocked users:', e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    setUnblockingId(blockedUserId);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const res = await fetch('/api/block', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockedUserId }),
      });
      if (res.ok) {
        toast.success(t('block.unblocked'));
        setBlockedUsers(prev => prev.filter(b => b.blocked_user_id !== blockedUserId));
      } else {
        toast.error(t('block.unblockFailed'));
      }
    } catch (e) {
      toast.error(t('block.unblockFailed'));
    } finally {
      setUnblockingId(null);
    }
  };

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('/api/support', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (response.ok) setTickets(await response.json());
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'destructive', in_progress: 'default', resolved: 'secondary',
    };
    const labels: Record<string, string> = {
      open: t('settings.statusOpen'),
      in_progress: t('settings.statusInProgress'),
      resolved: t('settings.statusResolved'),
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      technical: t('settings.categoryTechnical'),
      payment: t('settings.categoryPayment'),
      account: t('settings.categoryAccount'),
      other: t('settings.categoryOther'),
      contact: t('settings.contactLink'),
    };
    return labels[category] || category;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error(t('settings.passwordMismatch')); return; }
    if (passwordData.newPassword.length < 6) { toast.error(t('settings.passwordTooShort')); return; }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) { toast.error(error.message); }
      else {
        toast.success(t('settings.passwordChanged'));
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      toast.error(t('settings.passwordError'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const sectionClass = "border-2 shadow-sm bg-card rounded-2xl overflow-hidden";
  const triggerClass = "px-6 py-4 hover:no-underline hover:bg-muted/50";
  const rowClass = "flex items-center justify-between p-4 border border-border rounded-xl bg-muted/50";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('settings.back')}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
            <Settings className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-3">

          {/* Account */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="account" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.account')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.accountDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('settings.newPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder={t('settings.newPasswordPlaceholder')}
                          required minLength={6}
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings.confirmPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder={t('settings.confirmPasswordPlaceholder')}
                          required minLength={6}
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={isChangingPassword} className="w-full bg-orange-600 hover:bg-orange-700">
                      {isChangingPassword ? t('settings.changingPassword') : t('settings.changePasswordButton')}
                    </Button>
                  </form>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Appearance */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="appearance" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon className="h-5 w-5 text-orange-600" /> : <Sun className="h-5 w-5 text-orange-600" />}
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.appearance')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.appearanceDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className={rowClass}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('settings.darkMode')}</p>
                      <p className="text-xs text-muted-foreground">
                        {theme === 'dark' ? t('settings.darkModeActive') : t('settings.lightModeActive')}
                      </p>
                    </div>
                    <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} disabled={!mounted} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Language */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="language" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.language')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.languageDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-2">
                  {([
                    { code: 'sr', label: 'Srpski', flag: '🇷🇸' },
                    { code: 'en', label: 'English', flag: '🇬🇧' },
                  ] as const).map(({ code, label, flag }) => (
                    <button
                      key={code}
                      onClick={() => setLanguage(code)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                        language === code
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                          : 'border-border bg-muted/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{flag}</span>
                        <span className="text-sm font-medium text-foreground">{label}</span>
                      </div>
                      {language === code && (
                        <span className="text-xs font-semibold text-orange-600">✓</span>
                      )}
                    </button>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Sounds */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sounds" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-5 w-5 text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.sounds')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.soundsDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-3">
                  <div className={rowClass}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('settings.notificationSound')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.notificationSoundDesc')}</p>
                    </div>
                    <Switch checked={notificationsSoundEnabled} onCheckedChange={toggleNotificationsSound} />
                  </div>
                  <div className={rowClass}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('settings.messageSound')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.messageSoundDesc')}</p>
                    </div>
                    <Switch checked={messagesSoundEnabled} onCheckedChange={toggleMessagesSound} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Support */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="support" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center justify-between w-full pr-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-orange-600" />
                      <div className="text-left">
                        <div className="font-semibold text-foreground">{t('settings.support')}</div>
                        <div className="text-sm text-muted-foreground font-normal">
                          {tickets.length > 0
                            ? `${tickets.length} ${t('settings.ticketCount')}`
                            : t('settings.supportDesc')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setContactSupportModalOpen(true); }}
                      className="mr-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t('settings.newRequest')}
                    </button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {loadingTickets ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">{t('settings.loadingTickets')}</div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-sm text-muted-foreground">{t('settings.noTickets')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="p-4 border border-border rounded-xl bg-muted/50 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{ticket.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {getCategoryLabel(ticket.category)} · {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {getStatusBadge(ticket.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                          {ticket.attachment_url && (
                            <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-500 font-medium">
                              <Download className="h-3 w-3" />
                              {ticket.attachment_name || 'Prilog'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Install App */}
          {!isAppInstalled && (
            <div className={sectionClass}>
              <button
                onClick={handleInstallApp}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-orange-600" />
                  <div className="text-left">
                    <div className="font-semibold text-foreground">
                      {language === 'sr' ? 'Instaliraj aplikaciju' : 'Install App'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'sr' ? 'Dodaj MasterConnect na početni ekran' : 'Add MasterConnect to home screen'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Legal */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="legal" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.legal')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.legalDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-2">
                  {[
                    { href: '/privacy', icon: FileText, label: 'login.privacyPolicy', desc: 'settings.privacyPolicyDesc' },
                    { href: '/terms', icon: FileText, label: 'login.termsOfService', desc: 'settings.termsDesc' },
                    { href: '/contact', icon: Mail, label: 'settings.contactLink', desc: 'settings.contactLinkDesc' },
                  ].map(({ href, icon: Icon, label, desc }) => (
                    <Link key={href} href={href} target="_blank"
                      className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted/50 hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{t(label)}</p>
                          <p className="text-xs text-muted-foreground">{t(desc)}</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Blocked Users */}
          <div className={sectionClass}>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="blocked" className="border-0">
                <AccordionTrigger className={triggerClass}>
                  <div className="flex items-center gap-3">
                    <UserX className="h-5 w-5 text-orange-600" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{t('settings.blockedUsers')}</div>
                      <div className="text-sm text-muted-foreground font-normal">{t('settings.blockedUsersDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {loadingBlocked ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : blockedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('settings.noBlockedUsers')}</p>
                  ) : (
                    <div className="space-y-2">
                      {blockedUsers.map((block) => (
                        <div key={block.id} className={rowClass}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                              <UserX className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{block.blocked_user?.name || '—'}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('settings.blockedSince')}: {new Date(block.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblock(block.blocked_user_id)}
                            disabled={unblockingId === block.blocked_user_id}
                            className="shrink-0 gap-1.5 rounded-xl"
                          >
                            {unblockingId === block.blocked_user_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                            {unblockingId === block.blocked_user_id ? t('block.unblocking') : t('block.unblock')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Danger Zone */}
          <div className="border-2 border-red-200 dark:border-red-900 rounded-2xl overflow-hidden bg-red-50/30 dark:bg-red-950/20">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="danger" className="border-0">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-red-50 dark:hover:bg-red-950/30">
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    <div className="text-left">
                      <div className="font-semibold text-red-600">{t('settings.dangerZone')}</div>
                      <div className="text-sm text-red-500 font-normal">{t('settings.dangerZoneDesc')}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">{t('settings.deleteAccount')}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">{t('settings.deleteAccountDesc')}</p>
                    <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('settings.deleteAccountButton')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

        </div>
      </div>

      <DeleteAccountModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} />
      <ContactSupportModal open={contactSupportModalOpen} onOpenChange={setContactSupportModalOpen} onTicketCreated={fetchTickets} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
