'use client';

import { Phone } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';
import { parsePhone } from '@/lib/utils/parse-phone';

type ContactCardProps = {
  phone?: string | null;
  showPhone?: boolean;
  className?: string;
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ViberIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
      <path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z" />
    </svg>
  );
}

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
            <WhatsAppIcon />
            WhatsApp
          </a>
          <a
            href={`viber://chat?number=${encodeURIComponent(data.tel)}`}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#7B519D]/40 bg-[#7B519D]/10 text-[#7B519D] dark:text-[#9B8BF4] hover:bg-[#7B519D]/20 transition-colors font-medium text-sm"
          >
            <ViberIcon />
            Viber
          </a>
        </div>
      </div>
    </section>
  );
}
