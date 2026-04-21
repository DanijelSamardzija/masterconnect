'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en';
import sr from '../translations/sr';
import de from '../translations/de';

type Language = 'en' | 'sr' | 'de';

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
      if (savedLang && (savedLang === 'en' || savedLang === 'sr' || savedLang === 'de')) {
        setLanguageState(savedLang);
        return;
      }

      // Auto-detect: check browser language
      const browserLangs = navigator.languages || [navigator.language];
      const isSerbian = browserLangs.some((l) =>
        l.toLowerCase().startsWith('sr') || l.toLowerCase().startsWith('hr') || l.toLowerCase().startsWith('bs')
      );
      if (isSerbian) {
        setLanguageState('sr');
      }
    } catch (error) {
      console.warn('[LanguageContext] localStorage access blocked:', error);
    }
  }, []);

  useEffect(() => {
    loadTranslations(language);
  }, [language]);

  const loadTranslations = (lang: Language) => {
    setTranslations(lang === 'en' ? en : lang === 'de' ? de : sr);
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
