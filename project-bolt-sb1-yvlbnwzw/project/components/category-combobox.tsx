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
import { useLanguage } from '@/lib/contexts/language-context';
import { APP_CATEGORIES } from '@/lib/constants';

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[]; // ignored — kept for API compat
  placeholder?: string;
  disabled?: boolean;
  filterMode?: boolean;
  allCategoriesLabel?: string;
  dropdownSide?: 'top' | 'bottom';
}

export function CategoryCombobox({
  value,
  onChange,
  placeholder,
  disabled = false,
  filterMode = false,
  allCategoriesLabel,
  dropdownSide = 'bottom',
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const { t } = useLanguage();

  const resolvedPlaceholder = placeholder ?? t('createPost.categoryPlaceholder');
  const resolvedAllLabel = allCategoriesLabel ?? t('category.allCategories');

  const normalizeText = (text: string): string =>
    text.toLowerCase().trim()
      .replace(/\s+/g, ' ')
      .replace(/[đĐ]/g, 'd').replace(/[šŠ]/g, 's')
      .replace(/[čČćĆ]/g, 'c').replace(/[žŽ]/g, 'z')
      .replace(/[üÜ]/g, 'u').replace(/[äÄ]/g, 'a').replace(/[öÖ]/g, 'o');

  const options = React.useMemo(() => {
    const items = APP_CATEGORIES.map(cat => ({
      slug: cat.slug,
      icon: cat.icon,
      label: t(`category.${cat.slug}`),
    }));

    const filtered = searchValue
      ? items.filter(item =>
          normalizeText(item.label).includes(normalizeText(searchValue)) ||
          normalizeText(item.slug).includes(normalizeText(searchValue))
        )
      : items;

    return filtered;
  }, [searchValue, t]);

  // Display label for current value (slug → translated name)
  const displayValue = React.useMemo(() => {
    if (!value) return '';
    const found = APP_CATEGORIES.find(c => c.slug === value);
    if (found) return t(`category.${found.slug}`);
    return value; // fallback: show raw value (legacy data)
  }, [value, t]);

  const handleSelect = (slug: string) => {
    if (filterMode && slug === '__all__') {
      onChange('');
    } else {
      onChange(slug);
    }
    setOpen(false);
    setSearchValue('');
  };

  const showAllOption = filterMode && (!searchValue || normalizeText(resolvedAllLabel).includes(normalizeText(searchValue)));

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
          {displayValue || resolvedPlaceholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        side={dropdownSide}
        avoidCollisions={false}
      >
        <div className="flex flex-col">
          <div className="border-b p-2">
            <Input
              placeholder={resolvedPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'min(360px, 55vh)' }}>
            {options.length === 0 && !showAllOption ? (
              <div className="py-6 px-4 text-center text-sm text-muted-foreground">
                No categories found
              </div>
            ) : (
              <div className="p-1">
                {showAllOption && (
                  <button
                    onClick={() => handleSelect('__all__')}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      !value && 'bg-accent'
                    )}
                  >
                    <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                    {resolvedAllLabel}
                  </button>
                )}
                {options.map((option) => (
                  <button
                    key={option.slug}
                    onClick={() => handleSelect(option.slug)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      value === option.slug && 'bg-accent'
                    )}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', value === option.slug ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
