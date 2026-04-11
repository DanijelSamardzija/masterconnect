import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { LanguageProvider } from '@/lib/contexts/language-context';
import { NotificationProvider } from '@/components/notification-provider';
import { PWARegistration } from '@/components/pwa-registration';
import { PushNotificationManager } from '@/components/push-notification-manager';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { LayoutShell } from '@/components/layout-shell';

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
    title: 'GigZone - Platform for Professionals & Jobs',
    description: 'Find skilled professionals, post jobs, or offer your services.',
    url: 'https://www.gigzone.app',
    siteName: 'GigZone',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GigZone - Platform for Professionals & Jobs',
    description: 'Find skilled professionals, post jobs, or offer your services.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" suppressHydrationWarning>
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
      <body className={`${inter.className} flex flex-col min-h-screen h-dvh bg-background text-foreground`}>
        <LanguageProvider>
          <AuthProvider>
            <NotificationProvider key="notifications-v5">
              <Toaster />
              <Sonner />
            </NotificationProvider>

            <LayoutShell>{children}</LayoutShell>

            <PushNotificationManager />
            <PWARegistration />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

