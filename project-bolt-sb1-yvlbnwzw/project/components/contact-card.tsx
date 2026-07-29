'use client';

import { Phone, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { parsePhone } from '@/lib/utils/parse-phone';

type ContactCardProps = {
  phone?: string | null;
  showPhone?: boolean;
  className?: string;
};

export function ContactCard({ phone, showPhone, className }: ContactCardProps) {
  const { t } = useLanguage();
  if (showPhone === false) return null;
  const data = parsePhone(phone);
  if (!data) return null;

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        {t('profile.contactInformation')}
      </h2>
      <div className="space-y-2">
        <a
          href={`tel:${data.tel}`}
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
        >
          <Phone className="h-4 w-4 shrink-0" />
          <span className="font-medium text-sm">{data.display}</span>
        </a>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${data.wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 transition-colors font-medium text-sm"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            WhatsApp
          </a>
          <a
            href={`viber://chat?number=${encodeURIComponent(data.tel)}`}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#7360F2]/40 bg-[#7360F2]/10 text-[#7360F2] dark:text-[#9B8BF4] hover:bg-[#7360F2]/20 transition-colors font-medium text-sm"
          >
            <Phone className="h-4 w-4 shrink-0" />
            Viber
          </a>
        </div>
      </div>
    </section>
  );
}
