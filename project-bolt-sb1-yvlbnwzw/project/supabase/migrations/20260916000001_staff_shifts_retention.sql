-- ============================================================
-- Staff Shifts — 2-year rolling retention
--
-- Deletes staff_shifts rows whose shift_date is older than
-- exactly 2 years from today. Runs every day at 02:00 UTC.
--
-- Example: cron fires on 2028-09-05
--   → deletes rows where shift_date < 2026-09-05
--   (keeps everything from 2026-09-05 onward)
--
-- Requires the pg_cron extension. On Supabase enable it first:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- ============================================================

-- Safety: create a helper function so the cron job calls one
-- clean SQL statement rather than an inline DELETE.
CREATE OR REPLACE FUNCTION public.purge_old_staff_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.staff_shifts
  WHERE shift_date < (CURRENT_DATE - INTERVAL '2 years');
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_staff_shifts() TO postgres;

-- Remove any existing job with this name before (re-)creating it
SELECT cron.unschedule('purge-old-staff-shifts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-old-staff-shifts'
);

-- Schedule: every day at 02:00 UTC
SELECT cron.schedule(
  'purge-old-staff-shifts',
  '0 2 * * *',
  'SELECT public.purge_old_staff_shifts()'
);
