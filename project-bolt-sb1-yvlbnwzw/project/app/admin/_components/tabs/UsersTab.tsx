'use client';

import { Ban, Bell, ChevronDown, Coins, Eye, Loader2, MapPin, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils/date';
import Link from 'next/link';
import { UserProfile } from '../types';

interface Props {
  users: UserProfile[];
  loading: boolean;
  userSearch: string;
  userCountryFilter: string;
  hasMoreUsers: boolean;
  loadingMoreUsers: boolean;
  editLocationId: string | null;
  editLocationCity: string;
  editLocationCountry: string;
  creditTarget: { id: string; name: string } | null;
  creditAmount: string;
  grantingCredits: boolean;
  onSearchChange: (v: string) => void;
  onCountryFilterChange: (v: string) => void;
  onLoadMore: () => void;
  onEditLocationStart: (userId: string, city: string, country: string) => void;
  onEditLocationCancel: () => void;
  onEditLocationCityChange: (v: string) => void;
  onEditLocationCountryChange: (v: string) => void;
  onSaveLocation: (userId: string) => void;
  onCreditTargetSet: (target: { id: string; name: string }) => void;
  onCreditTargetClear: () => void;
  onCreditAmountChange: (v: string) => void;
  onGrantCredits: () => void;
  onToggleBan: (userId: string, name: string, currentlyBanned: boolean) => void;
  onDeleteUser: (userId: string, name: string) => void;
  onNotifTargetSet: (target: { id: string; name: string }) => void;
}

export function UsersTab({
  users,
  loading,
  userSearch,
  userCountryFilter,
  hasMoreUsers,
  loadingMoreUsers,
  editLocationId,
  editLocationCity,
  editLocationCountry,
  creditTarget,
  creditAmount,
  grantingCredits,
  onSearchChange,
  onCountryFilterChange,
  onLoadMore,
  onEditLocationStart,
  onEditLocationCancel,
  onEditLocationCityChange,
  onEditLocationCountryChange,
  onSaveLocation,
  onCreditTargetSet,
  onCreditTargetClear,
  onCreditAmountChange,
  onGrantCredits,
  onToggleBan,
  onDeleteUser,
  onNotifTargetSet,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={userSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Pretraži po imenu, emailu, gradu..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={userCountryFilter}
            onChange={e => onCountryFilterChange(e.target.value)}
            placeholder="Zemlja..."
            className="w-36 bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nema korisnika</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {users.map(u => (
              <div
                key={u.id}
                className={`bg-card border rounded-2xl px-4 py-3 flex items-center gap-3 ${
                  u.is_banned ? 'border-red-300 dark:border-red-800 opacity-75' : 'border-border'
                }`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="bg-orange-100 text-orange-700 font-semibold text-sm">
                    {u.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{u.name}</span>
                    {u.is_admin && (
                      <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                    {u.is_banned && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                        Banovan
                      </span>
                    )}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {u.account_type === 'professional' ? 'Profesionalac' : 'Klijent'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>

                  {editLocationId === u.id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        autoFocus
                        value={editLocationCity}
                        onChange={e => onEditLocationCityChange(e.target.value)}
                        placeholder="Grad"
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1 w-24 outline-none focus:border-orange-500/50"
                      />
                      <input
                        value={editLocationCountry}
                        onChange={e => onEditLocationCountryChange(e.target.value)}
                        placeholder="Zemlja"
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1 w-28 outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={() => onSaveLocation(u.id)}
                        className="text-xs text-green-600 font-semibold px-1.5 py-1 hover:text-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={onEditLocationCancel}
                        className="text-xs text-muted-foreground px-1 py-1 hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p
                      className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-orange-500 transition-colors group w-fit"
                      onClick={() => onEditLocationStart(u.id, u.city || '', u.country || '')}
                      title="Klikni da urediš lokaciju"
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[u.city, u.country].filter(Boolean).join(', ') || (
                        <span className="italic opacity-50">nema lokacije</span>
                      )}
                      <span className="opacity-0 group-hover:opacity-100 text-[10px]">✏️</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/profile/${u.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" title="Pogledaj profil">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    title="Pošalji notifikaciju"
                    onClick={() => onNotifTargetSet({ id: u.id, name: u.name })}
                  >
                    <Bell className="h-4 w-4" />
                  </Button>

                  {creditTarget?.id === u.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="number"
                        min="1"
                        value={creditAmount}
                        onChange={e => onCreditAmountChange(e.target.value)}
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1 w-14 outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={onGrantCredits}
                        disabled={grantingCredits}
                        className="text-xs text-green-600 font-semibold px-1.5 py-1 hover:text-green-700"
                      >
                        {grantingCredits ? '...' : '✓'}
                      </button>
                      <button
                        onClick={onCreditTargetClear}
                        className="text-xs text-muted-foreground px-1 py-1 hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-xl text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                      title="Dodaj kredite"
                      onClick={() => onCreditTargetSet({ id: u.id, name: u.name })}
                    >
                      <Coins className="h-4 w-4" />
                    </Button>
                  )}

                  {!u.is_admin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 rounded-xl transition-colors ${
                          u.is_banned
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950'
                            : 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950'
                        }`}
                        title={u.is_banned ? 'Odbani korisnika' : 'Banuj korisnika'}
                        onClick={() => onToggleBan(u.id, u.name, !!u.is_banned)}
                      >
                        {u.is_banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Obriši korisnika"
                        onClick={() => onDeleteUser(u.id, u.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMoreUsers && (
            <button
              onClick={onLoadMore}
              disabled={loadingMoreUsers}
              className="w-full py-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
            >
              {loadingMoreUsers
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Učitavanje...</>
                : <><ChevronDown className="h-4 w-4" /> Učitaj još</>
              }
            </button>
          )}
        </>
      )}
    </div>
  );
}
