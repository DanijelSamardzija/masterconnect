import { ServicesClient } from './services-client';

export default function ServicesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return <ServicesClient initialSearch={searchParams.q || ''} />;
}
