'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window === 'undefined') return;

    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      const initialTheme = savedTheme || 'light';

      setTheme(initialTheme);
      applyTheme(initialTheme);
    } catch (error) {
      console.warn('[useTheme] localStorage access blocked:', error);
      setTheme('light');
      applyTheme('light');
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      console.warn('[useTheme] localStorage write blocked:', error);
    }
    applyTheme(newTheme);
  };

  const setLightTheme = () => {
    setTheme('light');
    try {
      localStorage.setItem('theme', 'light');
    } catch (error) {
      console.warn('[useTheme] localStorage write blocked:', error);
    }
    applyTheme('light');
  };

  const setDarkTheme = () => {
    setTheme('dark');
    try {
      localStorage.setItem('theme', 'dark');
    } catch (error) {
      console.warn('[useTheme] localStorage write blocked:', error);
    }
    applyTheme('dark');
  };

  return {
    theme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    mounted
  };
}
