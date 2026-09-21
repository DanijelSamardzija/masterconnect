-- Migration 021: trade-photos storage bucket + Storage RLS policies +
--               updated_at triggers on trade tables that have the column.

BEGIN;

-- ── 1. Storage bucket ─────────────────────────────────────────────────────────
-- Private bucket. Paths follow: {business_id}/{job_id}/{photo_type}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-photos',
  'trade-photos',
  false,
  10485760,   -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Storage RLS policies ───────────────────────────────────────────────────
-- Business-scoped: caller must be active staff of the business whose id is
-- the first path segment.  get_my_business_ids() is SECURITY DEFINER and
-- handles both owners (primary profile) and secondary-profile staff.

DROP POLICY IF EXISTS "trade_photos_staff_select" ON storage.objects;
CREATE POLICY "trade_photos_staff_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trade-photos'
    AND (storage.foldername(name))[1]::uuid
          IN (SELECT public.get_my_business_ids())
  );

DROP POLICY IF EXISTS "trade_photos_staff_insert" ON storage.objects;
CREATE POLICY "trade_photos_staff_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trade-photos'
    AND (storage.foldername(name))[1]::uuid
          IN (SELECT public.get_my_business_ids())
  );

DROP POLICY IF EXISTS "trade_photos_staff_update" ON storage.objects;
CREATE POLICY "trade_photos_staff_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'trade-photos'
    AND (storage.foldername(name))[1]::uuid
          IN (SELECT public.get_my_business_ids())
  );

DROP POLICY IF EXISTS "trade_photos_staff_delete" ON storage.objects;
CREATE POLICY "trade_photos_staff_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'trade-photos'
    AND (storage.foldername(name))[1]::uuid
          IN (SELECT public.get_my_business_ids())
  );

-- ── 3. updated_at triggers ────────────────────────────────────────────────────
-- set_updated_at() exists from investment_tables.sql migration.
-- Only attach to tables that have an updated_at column:
--   trade_clients, trade_assets, trade_jobs, trade_job_materials.
-- trade_job_photos and trade_job_expenses have no updated_at column — skip.

CREATE TRIGGER set_trade_clients_updated_at
  BEFORE UPDATE ON public.trade_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_trade_assets_updated_at
  BEFORE UPDATE ON public.trade_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_trade_jobs_updated_at
  BEFORE UPDATE ON public.trade_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_trade_job_materials_updated_at
  BEFORE UPDATE ON public.trade_job_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
