'use client';

import { useLanguage } from '@/lib/contexts/language-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold border border-white/20">
          <span className="text-sm">
            {language === 'en' ? 'EN' : 'RS'}
          </span>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
