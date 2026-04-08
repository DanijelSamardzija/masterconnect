import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { LanguageProvider } from '@/lib/contexts/language-context';
import { NotificationProvider } from '@/components/notification-provider';
import { PWARegistration } from '@/components/pwa-registration';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { LayoutShell } from '@/components/layout-shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MasterConnect - Platforma za majstore i poslove',
  description:
    'Pronađite majstore, objavite poslove ili ponudite svoje usluge. Marketplace koji povezuje korisnike, pružaoce usluga i tražioce poslova.',
  keywords: ['majstori', 'poslovi', 'usluge', 'marketplace', 'zaposljavanje', 'masterconnect'],
  authors: [{ name: 'MasterConnect' }],
  metadataBase: new URL('https://handyman-service-pla-h96a.bolt.host'),
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
    title: 'MasterConnect',
  },
  openGraph: {
    title: 'MasterConnect - Platforma za majstore i poslove',
    description: 'Pronađite majstore, objavite poslove ili ponudite svoje usluge.',
    url: 'https://handyman-service-pla-h96a.bolt.host',
    siteName: 'MasterConnect',
    locale: 'sr_RS',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MasterConnect - Platforma za majstore i poslove',
    description: 'Pronađite majstore, objavite poslove ili ponudite svoje usluge.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" suppressHydrationWarning>
      <body className={`${inter.className} flex flex-col min-h-screen bg-background text-foreground`}>
        <LanguageProvider>
          <AuthProvider>
            <NotificationProvider key="notifications-v5">
              <Toaster />
              <Sonner />
            </NotificationProvider>

            <LayoutShell>{children}</LayoutShell>

            <PWARegistration />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

