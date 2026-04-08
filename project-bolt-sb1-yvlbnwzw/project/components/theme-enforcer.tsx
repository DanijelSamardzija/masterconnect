'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/reset-password'];

export function ThemeEnforcer() {
  const pathname = usePathname();

  useEffect(() => {
    const isPublicPage = PUBLIC_PATHS.includes(pathname);

    if (isPublicPage) {
      document.documentElement.classList.remove('dark');
    } else {
      try {
        const theme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const activeTheme = theme || systemTheme;

        if (activeTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.warn('[ThemeEnforcer] localStorage access blocked:', error);
        document.documentElement.classList.remove('dark');
      }
    }
  }, [pathname]);

  return null;
}
