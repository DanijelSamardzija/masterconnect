'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Calendar,
  Wrench,
  UtensilsCrossed,
  ShoppingBag,
  BedDouble,
  PartyPopper,
  ChevronRight,
  Search,
  LayoutDashboard,
  BookMarked,
} from 'lucide-react';

// Only these two users can access this page
const ALLOWED_IDS = [
  '1fa3b3fb-9fcc-43fe-a242-3415d7119a75', // Danijel Samardzija
  '3bddb236-a206-452f-8734-cfab73973161', // Zoran Samardzija
];

type Category = {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  href?: string;
  soon?: boolean;
};

const CATEGORIES: Category[] = [
  {
    key: 'termini',
    icon: <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
    iconBg: 'bg-orange-100 dark:bg-orange-950',
    title: 'Termini',
    desc: 'Rezerviši termin — frizer, doktor, trener i ostalo',
    href: '/services',
  },
  {
    key: 'majstori',
    icon: <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    title: 'Majstori i zanati',
    desc: 'Popravka, renovacija, instalacije — pošalji zahtjev',
    soon: true,
  },
  {
    key: 'restorani',
    icon: <UtensilsCrossed className="w-5 h-5 text-red-600 dark:text-red-400" />,
    iconBg: 'bg-red-100 dark:bg-red-950',
    title: 'Restorani i kafići',
    desc: 'Rezerviši sto — večera, ručak, kafa s društvom',
    soon: true,
  },
  {
    key: 'hrana',
    icon: <ShoppingBag className="w-5 h-5 text-green-600 dark:text-green-400" />,
    iconBg: 'bg-green-100 dark:bg-green-950',
    title: 'Hrana i dostava',
    desc: 'Naruči s dostavom ili preuzimanjem na licu mjesta',
    soon: true,
  },
  {
    key: 'smjestaj',
    icon: <BedDouble className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
    iconBg: 'bg-purple-100 dark:bg-purple-950',
    title: 'Smještaj',
    desc: 'Soba, apartman, vila — provjeri dostupnost i rezerviši',
    soon: true,
  },
  {
    key: 'dogadjaji',
    icon: <PartyPopper className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
    iconBg: 'bg-pink-100 dark:bg-pink-950',
    title: 'Događaji',
    desc: 'Koncerti, proslave i manifestacije',
    soon: true,
  },
];

function ComingSoonPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
        <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Booking — uskoro</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Ova stranica je u pripremi. Uskoro će biti dostupna svim korisnicima.
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        className="mt-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Nazad na početnu
      </button>
    </div>
  );
}

export default function BookingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const isAllowed = user && ALLOWED_IDS.includes(user.id);

  // Redirect to login if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAllowed) {
    return <ComingSoonPage />;
  }

  const filtered = CATEGORIES.filter(
    (c) =>
      search.trim() === '' ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {/* Page title */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Booking</h1>
          </div>

          {/* My booking / My reservations */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard/business')}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-accent transition-colors text-center"
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                <LayoutDashboard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Moje bukinge</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Upravljaj uslugama</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/booking/my')}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-accent transition-colors text-center"
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                <BookMarked className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Moje rezervacije</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Predstojeći termini</p>
              </div>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nađi šta ti treba..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Category buttons */}
          <div className="flex flex-col gap-2">
            {filtered.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  if (cat.soon) return;
                  router.push(cat.href!);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl bg-card border transition-colors text-left ${
                  cat.soon
                    ? 'border-border opacity-70 cursor-default'
                    : 'border-border hover:border-primary/50 hover:bg-accent cursor-pointer'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${cat.iconBg}`}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">{cat.desc}</p>
                </div>
                {cat.soon ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    Uskoro
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
