export const CATEGORIES = [
  'Construction & Trades',
  'Home Services',
  'IT & Tech',
  'Healthcare',
  'Education',
  'Transport & Delivery',
  'Hospitality & Tourism',
  'Retail & Sales',
  'Office & Admin',
  'Marketing & Media',
  'Finance & Accounting',
  'Legal',
  'Manufacturing',
  'Security',
  'Beauty & Wellness',
  'Arts & Creative',
  'Events & Entertainment',
  'Other',
] as const;

export const SERBIAN_CATEGORIES = [
  { value: 'keramičar', label: 'Keramičar', icon: '🔧', normalized: 'keramicar' },
  { value: 'moler', label: 'Moler', icon: '🎨', normalized: 'moler' },
  { value: 'električar', label: 'Električar', icon: '⚡', normalized: 'electricar' },
  { value: 'vodoinstalater', label: 'Vodoinstalater', icon: '🚰', normalized: 'vodoinstalater' },
  { value: 'stolar', label: 'Stolar', icon: '🪚', normalized: 'stolar' },
  { value: 'bravar', label: 'Bravar', icon: '🔨', normalized: 'bravar' },
  { value: 'zidar', label: 'Zidar', icon: '🧱', normalized: 'zidar' },
  { value: 'AutoMehaničar', label: 'Auto Mehaničar', icon: '🔧', normalized: 'automehanicar' },
  { value: 'klima', label: 'Klima uređaji', icon: '❄️', normalized: 'klima' },
  { value: 'staklar', label: 'Staklar', icon: '🪟', normalized: 'staklar' },
  { value: 'soboslikar', label: 'Soboslikar', icon: '🖌️', normalized: 'soboslikar' },
  { value: 'krovopokrivač', label: 'Krovopokrivač', icon: '🏠', normalized: 'krovopokrivac' },
  { value: 'baštovan', label: 'Baštovan', icon: '🌿', normalized: 'bastovan' },
  { value: 'čistač', label: 'Čistač', icon: '🧹', normalized: 'cistac' },
  { value: 'selidbe', label: 'Selidbe', icon: '🚚', normalized: 'selidbe' },
  { value: 'IT', label: 'IT & Računari', icon: '💻', normalized: 'it' },
  { value: 'ostalo', label: 'Ostalo', icon: '📦', normalized: 'ostalo' },
] as const;

export const CITIES = [
  'Belgrade',
  'Novi Sad',
  'Niš',
  'Kragujevac',
  'Subotica',
  'Zrenjanin',
  'Pančevo',
  'Čačak',
  'Other',
] as const;

export const SERBIAN_CITIES = [
  { value: 'Beograd', label: 'Beograd' },
  { value: 'Novi Sad', label: 'Novi Sad' },
  { value: 'Niš', label: 'Niš' },
  { value: 'Kragujevac', label: 'Kragujevac' },
  { value: 'Subotica', label: 'Subotica' },
  { value: 'Zrenjanin', label: 'Zrenjanin' },
  { value: 'Pančevo', label: 'Pančevo' },
  { value: 'Čačak', label: 'Čačak' },
  { value: 'Leskovac', label: 'Leskovac' },
  { value: 'Šabac', label: 'Šabac' },
  { value: 'Valjevo', label: 'Valjevo' },
  { value: 'Smederevo', label: 'Smederevo' },
  { value: 'Ostalo', label: 'Ostalo' },
] as const;

export type Category = typeof CATEGORIES[number];
export type City = typeof CITIES[number];
