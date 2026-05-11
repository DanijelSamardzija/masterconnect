'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';
import sr from '../translations/sr';
import de from '../translations/de';
import { supabase } from '@/lib/supabase/client';

type Language = 'en' | 'sr' | 'de';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const VALID: Language[] = ['en', 'sr', 'de'];
const STORAGE_KEY = 'lang';

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<string, string>>(en);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detect = async () => {
      try {
        // Priority 0: logged-in user's saved language in DB
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_language')
            .eq('id', user.id)
            .maybeSingle();
          if (profile?.preferred_language && VALID.includes(profile.preferred_language as Language)) {
            setLanguageState(profile.preferred_language as Language);
            localStorage.setItem(STORAGE_KEY, profile.preferred_language);
            return;
          }
        }

        // Priority 1: user's saved choice (support both old 'language' key and new 'lang')
        const saved = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem('language')) as Language;
        if (saved && VALID.includes(saved)) {
          setLanguageState(saved);
          return;
        }

        // Priority 2: browser language (instant, no network)
        const bl = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
        if (bl.startsWith('sr') || bl.startsWith('hr') || bl.startsWith('bs') || bl.startsWith('me')) {
          setLanguageState('sr');
          return;
        }
        if (bl.startsWith('de')) {
          setLanguageState('de');
          return;
        }

        // Priority 3: IP geolocation — only if browser lang is ambiguous (en/other)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          const cc = (data.country_code || '').toUpperCase();

          if (['RS', 'ME', 'BA', 'HR'].includes(cc)) {
            setLanguageState('sr');
          } else if (['DE', 'AT'].includes(cc)) {
            setLanguageState('de');
          }
          // else stays 'en'
        } catch {
          // IP detection failed or timed out — stay with 'en'
        }
      } catch (error) {
        console.warn('[LanguageContext] Detection error:', error);
      }
    };

    detect();
  }, []);

  useEffect(() => {
    setTranslations(language === 'de' ? de : language === 'sr' ? sr : en);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.warn('[LanguageContext] localStorage write blocked:', error);
    }
    // Persist to DB if logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').update({ preferred_language: lang }).eq('id', user.id);
      }
    });
  };

  const t = (key: string): string => translations[key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
