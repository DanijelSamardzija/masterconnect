import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
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

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'GigZone – Globalna platforma za profesionalce, kompanije, usluge i poslove',
  description:
    'Objavite posao, pronađite profesionalce, ponudite usluge ili predstavite svoj rad. GigZone povezuje firme, freelancere, kreatore sadržaja i korisnike na jednom mjestu.',
  keywords: ['profesionalci', 'usluge', 'poslovi', 'freelance', 'kreatori sadržaja', 'marketplace', 'gigzone'],
  authors: [{ name: 'GigZone' }],
  metadataBase: new URL('https://www.gigzone.app'),
  alternates: { canonical: 'https://www.gigzone.app' },
  manifest: '/manifest.json?v=landing-light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GigZone',
  },
  openGraph: {
    title: 'GigZone – Globalna platforma za profesionalce, kompanije, usluge i poslove',
    description: 'Objavite posao, pronađite profesionalce, ponudite usluge ili predstavite svoj rad. GigZone povezuje firme, freelancere, kreatore sadržaja i korisnike na jednom mjestu.',
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
    title: 'GigZone – Globalna platforma za profesionalce, kompanije, usluge i poslove',
    description: 'Objavite posao, pronađite profesionalce ili ponudite usluge. GigZone na jednom mjestu.',
    images: ['https://www.gigzone.app/icon-512.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.gigzone.app/#organization',
  name: 'GigZone',
  url: 'https://www.gigzone.app',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.gigzone.app/icon-512.png',
    width: 512,
    height: 512,
  },
  description: 'A global marketplace connecting professionals, service providers and job seekers in one place.',
  areaServed: ['RS', 'BA', 'HR', 'DE', 'AT', 'CH'],
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://www.gigzone.app/#website',
  name: 'GigZone',
  url: 'https://www.gigzone.app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = headers().get('x-lang') ?? 'sr';
  return (
    <html lang={lang} suppressHydrationWarning className="h-dvh">
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin} />
        )}
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:rounded-md focus:bg-background focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Preskoči na sadržaj
        </a>
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

