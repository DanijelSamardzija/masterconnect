import { MetadataRoute } from 'next';

const DISALLOW = [
  '/admin',
  '/api/',
  '/onboarding',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
  '/settings',
  '/messages',
  '/create-post',
  '/profile/edit',
  '/auth/',
  '/account-deleted',
  '/adult',
  '/adult-preview',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*',             allow: '/', disallow: DISALLOW },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'anthropic-ai',  allow: '/' },
    ],
    sitemap: 'https://www.gigzone.app/sitemap.xml',
  };
}
