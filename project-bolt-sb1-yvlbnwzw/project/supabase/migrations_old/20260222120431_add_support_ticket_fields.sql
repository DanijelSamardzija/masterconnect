/*
  # Add support ticket fields and attachments
  
  1. Changes to support_messages
    - Add `category` field with predefined options
    - Add `attachment_url` for file uploads
    - Add `attachment_name` for original filename
    - Rename status values for clarity
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to support_messages
ALTER TABLE support_messages 
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('technical', 'payment', 'account', 'other')) DEFAULT 'other',
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_name text;

-- Update status check constraint to use proper values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'support_messages' 
    AND constraint_name = 'support_messages_status_check'
  ) THEN
    ALTER TABLE support_messages DROP CONSTRAINT support_messages_status_check;
  END IF;
END $$;

ALTER TABLE support_messages 
ADD CONSTRAINT support_messages_status_check 
CHECK (status IN ('open', 'in_progress', 'resolved'));