'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wrench,
  LogOut,
  User,
  Briefcase,
  Menu,
  Search,
  MessageSquare,
  FileText,
  Settings,
  ChevronDown,
  Edit,
  Bell,
  Moon,
  Sun,
  Shield,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SearchModal } from '@/components/search-modal';
import { useTheme } from '@/hooks/use-theme';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme, mounted } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isFeedPage = pathname === '/feed';
  const isPublicPage =
    pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';
  const isLandingPage = pathname === '/';

  useEffect(() => {
    if (profile) {
      fetchUnreadCount();
      fetchNotificationUnreadCount();

      const handleUnreadCountChanged = () => {
        fetchUnreadCount();
        fetchNotificationUnreadCount();
      };

      window.addEventListener('unreadCountChanged', handleUnreadCountChanged);

      const messagesChannel = supabase
        .channel('nav-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchUnreadCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'thread_participants',
            filter: `user_id=eq.${profile.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      const notificationsChannel = supabase
        .channel('nav-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
          },
          (payload: any) => {
            // Only re-fetch if the new notification belongs to the current user
            if (payload.new?.user_id === profile.id) {
              fetchNotificationUnreadCount();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
          },
          (payload: any) => {
            if (payload.new?.user_id === profile.id) {
              fetchNotificationUnreadCount();
            }
          }
        )
        .subscribe();

      return () => {
        window.removeEventListener('unreadCountChanged', handleUnreadCountChanged);
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(notificationsChannel);
      };
    }
  }, [profile]);

  const fetchUnreadCount = async () => {
    if (!profile) return;

    const { data: participants, error } = await supabase
      .from('thread_participants')
      .select('thread_id, last_read_at')
      .eq('user_id', profile.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching unread count:', error);
      return;
    }

    let totalUnread = 0;
    for (const participant of participants || []) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', participant.thread_id)
        .neq('sender_id', profile.id)
        .eq('is_deleted', false)
        .eq('is_system', false)
        .gt('created_at', participant.last_read_at || '1970-01-01');

      totalUnread += count || 0;
    }

    setUnreadCount(totalUnread);
  };

  const fetchNotificationUnreadCount = async () => {
    if (!profile) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .is('read_at', null);

    if (error) {
      console.error('Error fetching notification unread count:', error);
      return;
    }

    setNotificationUnreadCount(count || 0);
  };

  if (isAuthPage || isFeedPage) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    router.push('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const desktopNavClass = (href: string) => {
    const active = isActiveRoute(href);

    if (isPublicPage && !isLandingPage) {
      return active
        ? 'gap-1.5 text-sm rounded-xl border border-orange-500 bg-orange-500/10 text-orange-600 shadow-sm transition-all duration-200'
        : 'gap-1.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200';
    }

    return active
      ? 'gap-1.5 text-sm rounded-xl border border-orange-500 bg-orange-500/10 text-orange-400 shadow-sm transition-all duration-200'
      : 'gap-1.5 text-sm text-slate-200 hover:text-white hover:bg-slate-800 transition-all duration-200';
  };

  const mobileNavClass = (href: string) => {
    const active = isActiveRoute(href);

    return active
      ? 'w-full justify-start gap-2 rounded-xl border border-orange-500 bg-orange-500/10 text-orange-400 shadow-sm transition-all duration-200'
      : 'w-full justify-start gap-2 rounded-xl text-foreground hover:bg-accent transition-all duration-200';
  };

  return (
    <nav
      className={`${
        isPublicPage && !isLandingPage
          ? 'bg-background/95 border-border'
          : 'bg-[#0b1220]/90 border-white/10 backdrop-blur-md'
      } border-b sticky top-0 z-50 shadow-lg`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className={`flex items-center gap-2.5 font-bold text-xl hover:opacity-80 transition-opacity ${
              isPublicPage && !isLandingPage ? 'text-slate-900' : 'text-white'
            }`}
          >
            <img src="/icon.svg" alt="G" className="h-9 w-9 rounded-xl shadow-md" />
            <span className="tracking-tight">{t('site.name')}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link href="/services">
              <Button variant="ghost" size="sm" className={desktopNavClass('/services')}>
                <Search className="h-4 w-4" />
                <span className="hidden lg:inline">{t('nav.discover')}</span>
              </Button>
            </Link>

            {user && profile ? (
              <>
                <Link href="/feed">
                  <Button variant="ghost" size="sm" className={desktopNavClass('/feed')}>
                    <FileText className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('nav.feed')}</span>
                  </Button>
                </Link>

                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className={desktopNavClass('/jobs')}>
                    <Briefcase className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('nav.jobs')}</span>
                  </Button>
                </Link>

                <Link href="/messages">
                  <Button variant="ghost" size="sm" className={`${desktopNavClass('/messages')} relative`}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('nav.messages')}</span>
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 px-1 py-0 h-4 min-w-4 flex items-center justify-center text-xs bg-orange-600"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className={`${desktopNavClass('/dashboard')} relative`}>
                    <Bell className="h-4 w-4" />
                    <span className="hidden lg:inline">{t('nav.dashboard')}</span>
                    {notificationUnreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 px-1 py-0 h-4 min-w-4 flex items-center justify-center text-xs bg-orange-600"
                      >
                        {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="h-8 w-8 text-slate-200 hover:text-white hover:bg-slate-800"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1 bg-slate-700" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  disabled={!mounted}
                  className="h-8 w-8 text-slate-200 hover:text-white hover:bg-slate-800"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <LanguageSwitcher className="h-8 w-8 text-slate-200 hover:text-white hover:bg-slate-800" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-auto py-1.5 text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                    >
                      <Avatar className="h-7 w-7">
                        {profile.avatar_url ? (
                          <AvatarImage src={profile.avatar_url} alt={profile.name} />
                        ) : (
                          <AvatarFallback className="bg-orange-600 text-white text-xs">
                            {profile.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="hidden xl:flex xl:items-center xl:gap-1.5">
                        <span className="text-sm font-medium max-w-[100px] truncate">{profile.name}</span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuItem onClick={() => router.push('/profile')}>
                      <User className="h-4 w-4 mr-2" />
                      {t('nav.myProfile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/edit')}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('nav.editProfile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings className="h-4 w-4 mr-2" />
                      {t('nav.settings')}
                    </DropdownMenuItem>
                    {profile?.is_admin && (
                      <DropdownMenuItem onClick={() => router.push('/admin')} className="text-orange-600 focus:text-orange-700">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700">
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('nav.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  disabled={!mounted}
                  className={`h-8 w-8 ${
                    isPublicPage && !isLandingPage
                      ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <LanguageSwitcher className={
                  isPublicPage && !isLandingPage
                    ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                } />

                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${
                      isPublicPage && !isLandingPage
                        ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                        : 'text-white hover:text-white hover:bg-white/10 border border-white/20'
                    }`}
                  >
                    {t('nav.signIn')}
                  </Button>
                </Link>

                <Link href="/login">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg">
                    {t('nav.signUp')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {user && profile ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="text-slate-200 hover:text-white hover:bg-slate-800"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Link href="/dashboard">
                  <Button variant="ghost" size="icon" className="relative text-slate-200 hover:text-white hover:bg-slate-800">
                    <Bell className="h-5 w-5" />
                    {notificationUnreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 px-1 py-0 h-4 min-w-4 flex items-center justify-center text-[10px] bg-orange-600 border-2 border-slate-900"
                      >
                        {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              </>
            ) : (
              <LanguageSwitcher />
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${
                    isPublicPage && !isLandingPage
                      ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto bg-background">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2.5">
                    <img src="/icon.svg" alt="G" className="h-8 w-8 rounded-xl shadow-sm" />
                    {t('site.name')}
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-4 mt-8 pb-8">
                  {user && profile && (
                    <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-sm">
                      <Avatar className="h-12 w-12">
                        {profile.avatar_url ? (
                          <AvatarImage src={profile.avatar_url} alt={profile.name} />
                        ) : (
                          <AvatarFallback className="bg-orange-600 text-white">
                            {profile.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{profile.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center gap-2">
                    <Button variant="outline" size="icon" onClick={toggleTheme} disabled={!mounted} className="h-9 w-9">
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }} className="h-9 w-9">
                      <Search className="h-4 w-4" />
                    </Button>
                    <LanguageSwitcher className="h-9 w-9" />
                  </div>

                  <Separator />

                  <Link href="/services" onClick={closeMobileMenu}>
                    <Button variant="ghost" className={mobileNavClass('/services')}>
                      <Search className="h-4 w-4" />
                      {t('nav.discover')}
                    </Button>
                  </Link>

                  {user && profile ? (
                    <>
                      <Link href="/feed" onClick={closeMobileMenu}>
                        <Button variant="ghost" className={mobileNavClass('/feed')}>
                          <FileText className="h-4 w-4" />
                          {t('nav.feed')}
                        </Button>
                      </Link>

                      <Link href="/jobs" onClick={closeMobileMenu}>
                        <Button variant="ghost" className={mobileNavClass('/jobs')}>
                          <Briefcase className="h-4 w-4" />
                          {t('nav.jobs')}
                        </Button>
                      </Link>

                      <Link href="/messages" onClick={closeMobileMenu}>
                        <Button variant="ghost" className={`${mobileNavClass('/messages')} relative`}>
                          <MessageSquare className="h-4 w-4" />
                          {t('nav.messages')}
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 min-w-5 flex items-center justify-center text-xs">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
                          )}
                        </Button>
                      </Link>

                      <Link href="/dashboard" onClick={closeMobileMenu}>
                        <Button variant="ghost" className={`${mobileNavClass('/dashboard')} relative`}>
                          <Bell className="h-4 w-4" />
                          {t('nav.dashboard')}
                          {notificationUnreadCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto px-1.5 py-0 h-5 min-w-5 flex items-center justify-center text-xs bg-orange-600"
                            >
                              {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                            </Badge>
                          )}
                        </Button>
                      </Link>

                      <Separator />

                      <Link href="/profile" onClick={closeMobileMenu}>
                        <Button variant="ghost" className="w-full justify-start gap-2 rounded-xl hover:bg-accent transition-all duration-200">
                          <User className="h-4 w-4" />
                          {t('nav.myProfile')}
                        </Button>
                      </Link>

                      <Link href="/settings" onClick={closeMobileMenu}>
                        <Button variant="ghost" className="w-full justify-start gap-2 rounded-xl hover:bg-accent transition-all duration-200">
                          <Settings className="h-4 w-4" />
                          {t('nav.settings')}
                        </Button>
                      </Link>

                      {profile?.is_admin && (
                        <Link href="/admin" onClick={closeMobileMenu}>
                          <Button variant="ghost" className="w-full justify-start gap-2 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 transition-all duration-200">
                            <Shield className="h-4 w-4" />
                            Admin Panel
                          </Button>
                        </Link>
                      )}

                      <Separator />

                      <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start gap-2 text-red-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all duration-200"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('nav.signOut')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={closeMobileMenu}>
                        <Button variant="ghost" className="w-full justify-start rounded-xl">
                          {t('nav.signIn')}
                        </Button>
                      </Link>

                      <Link href="/login" onClick={closeMobileMenu}>
                        <Button className="w-full rounded-xl bg-orange-600 hover:bg-orange-700">
                          {t('nav.signUp')}
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}
