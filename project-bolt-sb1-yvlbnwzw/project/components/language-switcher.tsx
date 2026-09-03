'use client';

import { useLanguage } from '@/lib/contexts/language-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-8 w-8 font-semibold text-xs ${className ?? ''}`}>
          {language === 'en' ? 'EN' : language === 'de' ? 'DE' : language === 'es' ? 'ES' : language === 'fr' ? 'FR' : 'RS'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-accent font-semibold' : ''}
        >
          <span className="mr-2 text-lg">🇬🇧</span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('sr')}
          className={language === 'sr' ? 'bg-accent font-semibold' : ''}
        >
          <span className="mr-2 text-lg">🇷🇸</span>
          Српски
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('de')}
          className={language === 'de' ? 'bg-accent font-semibold' : ''}
        >
          <span className="mr-2 text-lg">🇩🇪</span>
          Deutsch
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('es')}
          className={language === 'es' ? 'bg-accent font-semibold' : ''}
        >
          <span className="mr-2 text-lg">🇪🇸</span>
          Español
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('fr')}
          className={language === 'fr' ? 'bg-accent font-semibold' : ''}
        >
          <span className="mr-2 text-lg">🇫🇷</span>
          Français
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
