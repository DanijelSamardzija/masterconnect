'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Megaphone, X, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';
import { useLanguage } from '@/lib/contexts/language-context';

type Announcement = {
  id: string;
  title: string;
  body: string;
  title_en?: string;
  body_en?: string;
  title_de?: string;
  body_de?: string;
  title_es?: string;
  body_es?: string;
  title_fr?: string;
  body_fr?: string;
  created_at: string;
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    const fetchLatest = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, title_en, body_en, title_de, body_de, title_es, body_es, title_fr, body_fr, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      // Check if already dismissed in localStorage
      const dismissed = localStorage.getItem(`announcement_dismissed_${data.id}`);
      if (dismissed) return;

      setAnnouncement(data);
    };

    fetchLatest();
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem(`announcement_dismissed_${announcement.id}`, 'true');
    }
    setDismissed(true);
    setModalOpen(false);
  };

  if (!announcement || dismissed) return null;

  const displayTitle =
    (language === 'en' && announcement.title_en) ||
    (language === 'de' && announcement.title_de) ||
    (language === 'es' && announcement.title_es) ||
    (language === 'fr' && announcement.title_fr) ||
    announcement.title;

  const displayBody =
    (language === 'en' && announcement.body_en) ||
    (language === 'de' && announcement.body_de) ||
    (language === 'es' && announcement.body_es) ||
    (language === 'fr' && announcement.body_fr) ||
    announcement.body;

  return (
    <>
      {/* Banner */}
      <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center gap-3">
        <Megaphone className="h-4 w-4 shrink-0" />
        <button
          onClick={() => setModalOpen(true)}
          className="flex-1 flex items-center gap-1 text-left hover:underline min-w-0"
        >
          <span className="text-sm font-semibold truncate">{displayTitle}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-200">
            <div className="bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl">

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-xl">
                  <Megaphone className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-base">{displayTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(announcement.created_at, language)}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-accent text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {displayBody}
                </p>
              </div>

              {/* Footer */}
              <div className="px-5 pb-8 pt-2">
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 rounded-2xl bg-muted hover:bg-accent border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {language === 'en' ? 'Got it, close' : language === 'de' ? 'Verstanden, schließen' : language === 'es' ? 'Entendido, cerrar' : language === 'fr' ? 'Compris, fermer' : 'Razumio, zatvori'}
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
