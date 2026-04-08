/*
  # Add message attachments support

  1. New Storage Bucket
    - Create `message-attachments` bucket for storing files
    - Enable public access for viewing attachments
    - Set up RLS policies for upload/access control

  2. New Tables
    - `message_attachments`
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key to messages)
      - `file_url` (text, storage path)
      - `file_name` (text, original filename)
      - `file_type` (text, MIME type)
      - `file_size` (integer, bytes)
      - `created_at` (timestamp)
      - `uploaded_by` (uuid, foreign key to profiles)

  3. Security
    - Enable RLS on message_attachments table
    - Allow authenticated users to upload attachments
    - Allow thread participants to view attachments
    - Storage bucket policies for upload and public read
*/

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Storage policies: Allow public read access
CREATE POLICY "Public can view attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'message-attachments');

-- Storage policies: Allow users to delete their own uploads
CREATE POLICY "Users can delete own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_attachments
CREATE POLICY "Users can view attachments in their threads"
ON message_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN threads t ON m.thread_id = t.id
    WHERE m.id = message_attachments.message_id
    AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
  )
);

CREATE POLICY "Users can insert attachments to their messages"
ON message_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN threads t ON m.thread_id = t.id
    WHERE m.id = message_attachments.message_id
    AND (t.customer_id = auth.uid() OR t.pro_id = auth.uid())
    AND m.sender_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own attachments"
ON message_attachments
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);