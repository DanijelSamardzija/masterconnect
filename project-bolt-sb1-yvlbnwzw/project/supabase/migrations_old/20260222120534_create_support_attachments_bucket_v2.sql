/*
  # Create support attachments storage bucket
  
  1. Storage
    - Create `support-attachments` bucket for support ticket files
    - Configure bucket to be private with authenticated access only
    - Set up RLS policies for secure file access
    
  2. Security
    - Users can only upload to their own folder
    - Users can only view their own attachments
*/

-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload support attachments'
  ) THEN
    CREATE POLICY "Users can upload support attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'support-attachments' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Allow users to view their own attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view own support attachments'
  ) THEN
    CREATE POLICY "Users can view own support attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'support-attachments' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Allow users to delete their own attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own support attachments'
  ) THEN
    CREATE POLICY "Users can delete own support attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'support-attachments' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;