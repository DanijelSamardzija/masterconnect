import { notFound } from 'next/navigation';
import { SUPPORTED_LANGS, Lang } from '@/lib/i18n-config';

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  if (!SUPPORTED_LANGS.includes(params.lang as Lang)) notFound();
  return <>{children}</>;
}
