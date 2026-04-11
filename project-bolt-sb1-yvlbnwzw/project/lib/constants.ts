export const APP_CATEGORIES = [
  { slug: 'construction',  icon: '🏗️' },
  { slug: 'home_services', icon: '🏠' },
  { slug: 'it_technology', icon: '💻' },
  { slug: 'health',        icon: '🏥' },
  { slug: 'finance',       icon: '💰' },
  { slug: 'beauty',        icon: '💅' },
  { slug: 'security',      icon: '🔒' },
  { slug: 'education',     icon: '📚' },
  { slug: 'transport',     icon: '🚚' },
  { slug: 'food',          icon: '🍽️' },
  { slug: 'marketing',     icon: '📣' },
  { slug: 'legal',         icon: '⚖️' },
  { slug: 'real_estate',   icon: '🏢' },
  { slug: 'other',         icon: '📦' },
] as const;

export type CategorySlug = typeof APP_CATEGORIES[number]['slug'];

// Legacy — kept for backward compat during migration
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

export const SERBIAN_CATEGORIES = APP_CATEGORIES;

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
