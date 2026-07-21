import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
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
      ],
    },
    sitemap: 'https://www.gigzone.app/sitemap.xml',
  };
}
