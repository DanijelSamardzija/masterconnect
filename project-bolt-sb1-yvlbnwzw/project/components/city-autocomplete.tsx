'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Check, MapPin, Loader2, PenLine } from 'lucide-react';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string, placeData?: { city: string; country: string; place_id: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showAllOption?: boolean;
  className?: string;
  error?: string;
}

interface NominatimPlace {
  place_id: number;
  display_name: string;
  type: string;
  address?: {
    city?: string;
    town?: string;
    country?: string;
  };
}

const SERBIAN_CITIES = [
  'Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Zrenjanin', 'Pančevo',
  'Čačak', 'Kruševac', 'Kraljevo', 'Smederevo', 'Novi Pazar', 'Leskovac', 'Vranje',
  'Užice', 'Valjevo', 'Šabac', 'Sombor', 'Požarevac', 'Pirot', 'Zaječar', 'Kikinda',
  'Sremska Mitrovica', 'Jagodina', 'Vršac', 'Bor', 'Prokuplje', 'Loznica', 'Negotin',
  'Lazarevac', 'Bečej', 'Paraćin', 'Vrnjačka Banja', 'Inđija', 'Ruma', 'Ćuprija',
  'Čurug', 'Čoka', 'Žabalj', 'Žitište', 'Šid', 'Đakovica', 'Kosovska Mitrovica',
  'Mladenovac', 'Aranđelovac', 'Sopot', 'Obrenovac', 'Stara Pazova', 'Bačka Palanka',
  'Bački Petrovac', 'Temerin', 'Beočin', 'Srbobran', 'Apatin', 'Odžaci', 'Kula',
  'Mali Zvornik', 'Ljubovija', 'Bajina Bašta', 'Krupanj', 'Boljevac', 'Kladovo',
  'Majdanpek', 'Despotovac', 'Rekovac', 'Svilajnac', 'Aleksinac', 'Ražanj', 'Doljevac',
  'Gadžin Han', 'Merošina', 'Brus', 'Aleksandrovac', 'Ćićevac', 'Trstenik', 'Arilje',
  'Ivanjica', 'Čajetina', 'Kosjerić', 'Požega', 'Priboj', 'Prijepolje', 'Nova Varoš',
  'Sjenica', 'Tutin', 'Blace', 'Žitorađa', 'Kuršumlija', 'Lebane', 'Medveđa', 'Bojnik',
  'Vlasotince', 'Surdulica', 'Crna Trava', 'Bosilegrad', 'Bujanovac', 'Preševo', 'Vladičin Han'
];

// Normalize known city name variants to canonical form
const CITY_NORMALIZE: Record<string, string> = {
  'wien': 'Beč',
  'vienna': 'Beč',
  'bec': 'Beč',
  'grad zagreb': 'Zagreb',
  'münchen': 'Minhen',
  'munich': 'Minhen',
  'munchen': 'Minhen',
  'köln': 'Keln',
  'cologne': 'Keln',
  'frankfurt am main': 'Frankfurt',
  'berlin': 'Berlin',
  'hamburg': 'Hamburg',
  'Stuttgart': 'Štutgart',
  'stuttgart': 'Štutgart',
  'zürich': 'Cirih',
  'zurich': 'Cirih',
  'geneva': 'Ženeva',
  'genève': 'Ženeva',
  'brussels': 'Brisel',
  'bruxelles': 'Brisel',
  'amsterdam': 'Amsterdam',
  'london': 'London',
  'paris': 'Pariz',
  'rome': 'Rim',
  'roma': 'Rim',
  'milan': 'Milano',
  'milano': 'Milano',
  'trieste': 'Trst',
  'ljubljana': 'Ljubljana',
  'graz': 'Grac',
  'linz': 'Linc',
  'salzburg': 'Salcburg',
};

function normalizeCityName(name: string): string {
  const key = name.toLowerCase().trim();
  return CITY_NORMALIZE[key] || name;
}

function normalizeSerbianText(text: string): string {
  return text
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    .trim();
}

const CYRILLIC_MAP: Record<string, string> = {
  'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Ђ':'Đ','Е':'E','Ж':'Ž','З':'Z','И':'I',
  'Ј':'J','К':'K','Л':'L','Љ':'Lj','М':'M','Н':'N','Њ':'Nj','О':'O','П':'P','Р':'R',
  'С':'S','Т':'T','Ћ':'Ć','У':'U','Ф':'F','Х':'H','Ц':'C','Ч':'Č','Џ':'Dž','Ш':'Š',
  'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'đ','е':'e','ж':'ž','з':'z','и':'i',
  'ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r',
  'с':'s','т':'t','ћ':'ć','у':'u','ф':'f','х':'h','ц':'c','ч':'č','џ':'dž','ш':'š',
};

export function cyrillicToLatin(text: string): string {
  return text.replace(/[А-ЯЂЉЊЋЏа-яђљњћџ]/g, (ch) => CYRILLIC_MAP[ch] ?? ch);
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Enter city...',
  disabled = false,
  required = false,
  showAllOption = false,
  className = '',
  error,
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<NominatimPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [hasSelected, setHasSelected] = useState(!!value);
  const [searchDone, setSearchDone] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInputValue(value);
    setHasSelected(!!value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        // If user didn't select from list and not in manual mode, reset
        if (!hasSelected && !manualMode && inputValue && inputValue !== value) {
          setInputValue(value);
        }
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hasSelected, manualMode, inputValue, value]);

  const searchCities = async (input: string) => {
    if (!input || input.length < 2) {
      setPredictions([]);
      setSearchDone(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setSearchDone(false);

    try {
      const normalizedInput = normalizeSerbianText(input);

      const localMatches = SERBIAN_CITIES
        .filter(city => normalizeSerbianText(city).includes(normalizedInput))
        .slice(0, 5)
        .map((city, index) => ({
          place_id: -(index + 1),
          display_name: `${city}, Serbia`,
          type: 'city',
          address: {
            city: city,
            country: 'Srbija'
          }
        }));

      if (localMatches.length > 0) {
        setPredictions(localMatches);
        setIsLoading(false);
        setSearchDone(true);
        return;
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&addressdetails=1&limit=10&accept-language=sr-Latn,hr,bs,en`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }

      const data: NominatimPlace[] = await response.json();

      const filteredCities = data.filter(place =>
        place.type === 'city' ||
        place.type === 'town' ||
        place.type === 'administrative'
      );

      setPredictions(filteredCities.slice(0, 5));
      setIsLoading(false);
      setSearchDone(true);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching city predictions:', error);
        setPredictions([]);
        setSearchDone(true);
      }
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHasSelected(false);
    setIsOpen(true);
    setSearchDone(false);

    if (newValue.length >= 2) {
      searchCities(newValue);
    } else {
      setPredictions([]);
    }

    if (newValue === '') {
      onChange('');
      setHasSelected(false);
    }
  };

  const handleCitySelect = (place: NominatimPlace) => {
    const raw = place.address?.city || place.address?.town || place.display_name.split(',')[0];
    const cityName = normalizeCityName(cyrillicToLatin(raw.trim()));
    const country = place.address?.country || '';

    setInputValue(cityName);
    setIsOpen(false);
    setPredictions([]);
    setHasSelected(true);
    setManualMode(false);

    onChange(cityName, {
      city: cityName,
      country: country,
      place_id: place.place_id.toString(),
    });
  };

  const handleManualEntry = () => {
    setManualMode(true);
    setIsOpen(false);
    setPredictions([]);
    setHasSelected(true);
    onChange(inputValue);
  };

  const handleAllCitiesSelect = () => {
    setInputValue('');
    onChange('');
    setIsOpen(false);
    setPredictions([]);
    setHasSelected(false);
  };

  const handleFocus = () => {
    if (inputValue.length >= 2) {
      setIsOpen(true);
      searchCities(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    if (e.key === 'Enter' && manualMode) {
      setHasSelected(true);
      onChange(inputValue);
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!hasSelected && !manualMode && inputValue && inputValue !== value) {
        setInputValue(value);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className={error ? 'border-red-500' : ''}
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {showAllOption && (
            <button
              type="button"
              onClick={handleAllCitiesSelect}
              className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between border-b border-gray-200 dark:border-slate-700"
            >
              <span className="font-medium text-gray-900 dark:text-white">All Cities</span>
              {value === '' && <Check className="h-4 w-4 text-primary" />}
            </button>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
            </div>
          )}

          {!isLoading && predictions.length === 0 && searchDone && inputValue.length >= 2 && (
            <div className="px-3 py-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Grad nije pronađen</p>
              <button
                type="button"
                onClick={handleManualEntry}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
              >
                <PenLine className="h-3.5 w-3.5" />
                Unesi &quot;{inputValue}&quot; ručno
              </button>
            </div>
          )}

          {!isLoading && predictions.length > 0 && predictions.map((place) => {
            const cityName = place.address?.city || place.address?.town || place.display_name.split(',')[0];
            const displayName = normalizeCityName(cyrillicToLatin(cityName.trim()));

            return (
              <button
                key={place.place_id}
                type="button"
                onClick={() => handleCitySelect(place)}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-1 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</div>
                  {place.address?.country && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{place.address.country}</div>
                  )}
                </div>
                {displayName === value && (
                  <Check className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
