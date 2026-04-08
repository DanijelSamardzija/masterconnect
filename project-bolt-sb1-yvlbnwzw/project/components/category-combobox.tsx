'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/lib/contexts/language-context';
import { supabase } from '@/lib/supabase/client';

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  filterMode?: boolean;
  allCategoriesLabel?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Select or type category...',
  disabled = false,
  filterMode = false,
  allCategoriesLabel = '',
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [dbSuggestions, setDbSuggestions] = React.useState<string[]>([]);
  const { t } = useLanguage();

  React.useEffect(() => {
    supabase
      .from('profiles')
      .select('category')
      .not('category', 'is', null)
      .neq('category', '')
      .then(({ data }) => {
        if (data) {
          const unique = Array.from(new Set(data.map((r) => r.category as string).filter(Boolean)));
          setDbSuggestions(unique);
        }
      });
  }, []);

  const otherOption = t('category.other');

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[đĐ]/g, 'd')
      .replace(/[šŠ]/g, 's')
      .replace(/[čČ]/g, 'c')
      .replace(/[ćĆ]/g, 'c')
      .replace(/[žŽ]/g, 'z');
  };

  const handleSelect = (selectedValue: string) => {
    if (filterMode && allCategoriesLabel && selectedValue === allCategoriesLabel) {
      onChange('');
      setOpen(false);
      setSearchValue('');
      return;
    }

    const trimmedValue = selectedValue.trim().replace(/\s+/g, ' ');
    onChange(trimmedValue);
    setOpen(false);
    setSearchValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filterMode && e.key === 'Enter' && searchValue.trim()) {
      e.preventDefault();
      const trimmedValue = searchValue.trim().replace(/\s+/g, ' ');
      onChange(trimmedValue);
      setOpen(false);
      setSearchValue('');
    }
  };

  const allOptions = React.useMemo(() => {
    console.log('[CategoryCombobox] Computing options:', {
      suggestionsCount: suggestions.length,
      suggestions: suggestions,
      searchValue,
      filterMode,
      allCategoriesLabel
    });

    const uniqueSuggestions = Array.from(new Set([...dbSuggestions, ...suggestions]));
    const filtered = uniqueSuggestions.filter((suggestion) => {
      if (!searchValue) return true;
      const normalizedSuggestion = normalizeText(suggestion);
      const normalizedSearch = normalizeText(searchValue);
      return normalizedSuggestion.includes(normalizedSearch);
    });

    console.log('[CategoryCombobox] Filtered results:', filtered);

    if (filterMode && allCategoriesLabel) {
      const allCatOption = allCategoriesLabel;
      const shouldShowAllCat = !searchValue || normalizeText(allCatOption).includes(normalizeText(searchValue));
      const result = shouldShowAllCat ? [allCatOption, ...filtered] : filtered;
      console.log('[CategoryCombobox] Final options (filter mode):', result);
      return result;
    }

    const shouldShowOther = !searchValue || normalizeText(otherOption).includes(normalizeText(searchValue));
    const result = shouldShowOther ? [...filtered, otherOption] : filtered;
    console.log('[CategoryCombobox] Final options:', result);
    return result;
  }, [suggestions, dbSuggestions, searchValue, otherOption, filterMode, allCategoriesLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        side="bottom"
        avoidCollisions={false}
      >
        <div className="flex flex-col">
          <div className="border-b p-2">
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[300px]">
            {allOptions.length === 0 ? (
              <div className="py-6 px-4 text-center text-sm text-muted-foreground">
                {filterMode ? 'No categories found' : (
                  <>{t('category.pressEnterToAdd')} &quot;{searchValue}&quot;</>
                )}
              </div>
            ) : (
              <div className="p-1">
                {allOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      value === option && 'bg-accent'
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option || (filterMode && !value && option === allCategoriesLabel) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
