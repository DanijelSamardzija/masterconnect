'use client';

import { Loader2, Megaphone, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils/date';
import { Announcement, LangStat } from '../types';
import { LANG_INFO } from '../constants';

interface Props {
  announcements: Announcement[];
  langStats: LangStat[];
  newTitle: string;
  newBody: string;
  newTitleEn: string;
  newBodyEn: string;
  newTitleDe: string;
  newBodyDe: string;
  newTitleEs: string;
  newBodyEs: string;
  newTitleFr: string;
  newBodyFr: string;
  sendEmail: boolean;
  emailOffset: number;
  savingAnnouncement: boolean;
  onNewTitleChange: (v: string) => void;
  onNewBodyChange: (v: string) => void;
  onNewTitleEnChange: (v: string) => void;
  onNewBodyEnChange: (v: string) => void;
  onNewTitleDeChange: (v: string) => void;
  onNewBodyDeChange: (v: string) => void;
  onNewTitleEsChange: (v: string) => void;
  onNewBodyEsChange: (v: string) => void;
  onNewTitleFrChange: (v: string) => void;
  onNewBodyFrChange: (v: string) => void;
  onSendEmailToggle: () => void;
  onEmailOffsetChange: (v: number) => void;
  onPublish: () => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}

export function AnnouncementsTab({
  announcements,
  langStats,
  newTitle,
  newBody,
  newTitleEn,
  newBodyEn,
  newTitleDe,
  newBodyDe,
  newTitleEs,
  newBodyEs,
  newTitleFr,
  newBodyFr,
  sendEmail,
  emailOffset,
  savingAnnouncement,
  onNewTitleChange,
  onNewBodyChange,
  onNewTitleEnChange,
  onNewBodyEnChange,
  onNewTitleDeChange,
  onNewBodyDeChange,
  onNewTitleEsChange,
  onNewBodyEsChange,
  onNewTitleFrChange,
  onNewBodyFrChange,
  onSendEmailToggle,
  onEmailOffsetChange,
  onPublish,
  onToggle,
  onDelete,
}: Props) {
  const inputClass = 'w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-orange-500/50 transition-colors';
  const textareaClass = `${inputClass} resize-none`;

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-orange-500" />
          Novo obavještenje
        </p>

        {/* Serbian */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇷🇸 Srpski (obavezno)</p>
          <input
            type="text"
            value={newTitle}
            onChange={e => onNewTitleChange(e.target.value)}
            placeholder="Naslov..."
            className={inputClass}
          />
          <textarea
            value={newBody}
            onChange={e => onNewBodyChange(e.target.value)}
            placeholder="Tekst obavještenja..."
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* English */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇬🇧 English (opciono)</p>
          <input
            type="text"
            value={newTitleEn}
            onChange={e => onNewTitleEnChange(e.target.value)}
            placeholder="Title..."
            className={inputClass}
          />
          <textarea
            value={newBodyEn}
            onChange={e => onNewBodyEnChange(e.target.value)}
            placeholder="Announcement text..."
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* German */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇩🇪 Deutsch (opciono)</p>
          <input
            type="text"
            value={newTitleDe}
            onChange={e => onNewTitleDeChange(e.target.value)}
            placeholder="Titel..."
            className={inputClass}
          />
          <textarea
            value={newBodyDe}
            onChange={e => onNewBodyDeChange(e.target.value)}
            placeholder="Ankündigungstext..."
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Spanish */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇪🇸 Español (opciono)</p>
          <input
            type="text"
            value={newTitleEs}
            onChange={e => onNewTitleEsChange(e.target.value)}
            placeholder="Título..."
            className={inputClass}
          />
          <textarea
            value={newBodyEs}
            onChange={e => onNewBodyEsChange(e.target.value)}
            placeholder="Texto del anuncio..."
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* French */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇫🇷 Français (opciono)</p>
          <input
            type="text"
            value={newTitleFr}
            onChange={e => onNewTitleFrChange(e.target.value)}
            placeholder="Titre..."
            className={inputClass}
          />
          <textarea
            value={newBodyFr}
            onChange={e => onNewBodyFrChange(e.target.value)}
            placeholder="Texte de l'annonce..."
            rows={3}
            className={textareaClass}
          />
        </div>

        {/* Email toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={onSendEmailToggle}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${sendEmail ? 'bg-orange-500' : 'bg-muted-foreground/30'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${sendEmail ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm text-muted-foreground">Pošalji i mejl svim korisnicima</span>
        </label>

        {sendEmail && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Počni od korisnika #</span>
            <input
              type="number"
              min={0}
              value={emailOffset}
              onChange={e => onEmailOffsetChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-orange-500/50 transition-colors"
            />
            <span className="text-xs text-muted-foreground">(0 = od početka, 560 = treća tura)</span>
          </div>
        )}

        <button
          onClick={onPublish}
          disabled={savingAnnouncement || !newTitle.trim() || !newBody.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {savingAnnouncement
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Objavljivanje...</>
            : <><Megaphone className="h-4 w-4" /> Objavi svim korisnicima</>
          }
        </button>
      </div>

      {/* Language breakdown */}
      {langStats.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Korisnici po jeziku</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4 font-medium">Jezik</th>
                  <th className="pb-2 pr-4 font-medium">Korisnici</th>
                  <th className="pb-2 font-medium">Emailovi</th>
                </tr>
              </thead>
              <tbody>
                {langStats.map(({ lang, count, emails }) => (
                  <tr key={lang} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">
                      {lang === 'other'
                        ? '🌍 Ostalo'
                        : `${LANG_INFO[lang]?.flag ?? '🌐'} ${LANG_INFO[lang]?.name ?? lang.toUpperCase()}`}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{count}</td>
                    <td className="py-2.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(emails.join(', '));
                          toast.success(`${count} email adresa kopirano`);
                        }}
                        className="text-xs px-3 py-1 bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
                      >
                        Kopiraj email adrese
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nema obavještenja</p>
          <p className="text-sm">Kreiraj prvo obavještenje gore</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div
              key={a.id}
              className={`bg-card border rounded-2xl p-5 ${a.active ? 'border-orange-300 dark:border-orange-800' : 'border-border opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{a.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.active
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {a.active ? 'Aktivno' : 'Neaktivno'}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{a.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggle(a.id, a.active)}
                    title={a.active ? 'Deaktiviraj' : 'Aktiviraj'}
                    className={`p-1.5 rounded-xl transition-colors ${
                      a.active
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {a.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    title="Obriši"
                    className="p-1.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
