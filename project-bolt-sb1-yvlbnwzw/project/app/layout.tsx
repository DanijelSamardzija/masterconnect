import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { LanguageProvider } from '@/lib/contexts/language-context';
import { NotificationProvider } from '@/components/notification-provider';
import { PWARegistration } from '@/components/pwa-registration';
import { PushNotificationManager } from '@/components/push-notification-manager';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { LayoutShell } from '@/components/layout-shell';
import { GuestGateProvider } from '@/lib/contexts/guest-gate-context';
import { PostHogProvider } from '@/lib/posthog/provider';
import { UtmTracker } from '@/components/utm-tracker';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GigZone - Platforma za majstore i poslove',
  description:
    'Pronađite majstore, objavite poslove ili ponudite svoje usluge. Marketplace koji povezuje korisnike, pružaoce usluga i tražioce poslova.',
  keywords: ['majstori', 'poslovi', 'usluge', 'marketplace', 'zaposljavanje', 'gigzone'],
  authors: [{ name: 'GigZone' }],
  metadataBase: new URL('https://www.gigzone.app'),
  manifest: '/manifest.json?v=landing-light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GigZone',
  },
  openGraph: {
    title: 'GigZone - Platforma za majstore i poslove',
    description: 'Pronađite majstore, objavite poslove ili ponudite svoje usluge. Marketplace za ex-YU zajednicu u zemlji i dijaspori.',
    url: 'https://www.gigzone.app',
    siteName: 'GigZone',
    locale: 'sr_RS',
    type: 'website',
    images: [
      {
        url: 'https://www.gigzone.app/icon-512.png',
        width: 512,
        height: 512,
        alt: 'GigZone logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'GigZone - Platforma za majstore i poslove',
    description: 'Pronađite majstore, objavite poslove ili ponudite svoje usluge.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" suppressHydrationWarning className="h-dvh">
      <head>
        {/* Apply dark class BEFORE first render to prevent flash of light mode on refresh */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body className={`${inter.className} flex flex-col h-dvh bg-background text-foreground`}>
        <LanguageProvider>
          <AuthProvider>
            <PostHogProvider>
            <GuestGateProvider>
            <NotificationProvider key="notifications-v5">
              <Toaster />
              <Sonner />
            </NotificationProvider>

            <Suspense><UtmTracker /></Suspense>
            <LayoutShell>{children}</LayoutShell>

            <PushNotificationManager />
            <PWARegistration />
            <Analytics />
            </GuestGateProvider>
            </PostHogProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

