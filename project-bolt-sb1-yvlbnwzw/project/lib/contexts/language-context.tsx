'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';
import sr from '../translations/sr';

type Language = 'en' | 'sr';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedLang = localStorage.getItem('language') as Language;
      if (savedLang && (savedLang === 'en' || savedLang === 'sr')) {
        setLanguageState(savedLang);
      }
    } catch (error) {
      console.warn('[LanguageContext] localStorage access blocked:', error);
    }
  }, []);

  useEffect(() => {
    loadTranslations(language);
  }, [language]);

  const loadTranslations = (lang: Language) => {
    setTranslations(lang === 'en' ? en : sr);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('language', lang);
    } catch (error) {
      console.warn('[LanguageContext] localStorage write blocked:', error);
    }
  };

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
