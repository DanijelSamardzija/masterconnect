-- Add logo_url to booking profiles and create public storage bucket for logos.

ALTER TABLE public.booking_profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-logos', 'booking-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read booking logos" ON storage.objects;
CREATE POLICY "Public read booking logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-logos');

DROP POLICY IF EXISTS "Owners can upload booking logos" ON storage.objects;
CREATE POLICY "Owners can upload booking logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'booking-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can update booking logos" ON storage.objects;
CREATE POLICY "Owners can update booking logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'booking-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can delete booking logos" ON storage.objects;
CREATE POLICY "Owners can delete booking logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'booking-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
