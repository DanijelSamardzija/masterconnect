import { JobsClient } from './jobs-client';

export default function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return <JobsClient initialSearch={searchParams.q || ''} />;
}
