import Link from 'next/link';
import { timeAgo } from '@/lib/utils/date';

type JobPostCardProps = {
  id: string;
  job_title: string | null;
  text: string | null;
  post_type: string;
  city: string | null;
  experience_level: string | null;
  created_at: string;
  author_name: string;
  lang: string;
};

const TYPE_BADGE: Record<string, { label: Record<string, string>; className: string }> = {
  hiring_post: {
    label: { sr: 'Tražim radnika', en: 'Hiring', de: 'Stelle frei' },
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  job_seeker_post: {
    label: { sr: 'Tražim posao', en: 'Looking for work', de: 'Arbeit gesucht' },
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  service_request: {
    label: { sr: 'Tražim uslugu', en: 'Need service', de: 'Service gesucht' },
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export function JobPostCard({
  id,
  job_title,
  text,
  post_type,
  city,
  experience_level,
  created_at,
  author_name,
  lang,
}: JobPostCardProps) {
  const badge = TYPE_BADGE[post_type];
  const badgeLabel = badge?.label[lang] ?? badge?.label.en ?? post_type;
  const headline = job_title || (text || '').slice(0, 80) || 'Oglas';

  return (
    <Link
      href={`/posts/${id}`}
      className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
            {headline}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span>{author_name}</span>
            {city && <span>· {city}</span>}
            {experience_level && <span>· {experience_level}</span>}
            <span>· {timeAgo(created_at)}</span>
          </div>
        </div>
        {badge && (
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
            {badgeLabel}
          </span>
        )}
      </div>
    </Link>
  );
}
