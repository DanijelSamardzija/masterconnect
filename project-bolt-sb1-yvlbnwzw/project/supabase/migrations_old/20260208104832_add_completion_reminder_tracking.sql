/*
  # Add completion reminder tracking

  1. Changes
    - Add `completion_reminder_sent_at` column to `jobs` table to track when reminder was sent
    - This ensures reminders are only sent once per completion request cycle
  
  2. Security
    - No RLS changes needed (inherits existing job policies)
  
  3. Notes
    - Field is cleared when:
      - Pro cancels completion request
      - Customer confirms or declines completion
      - Pro makes a new completion request (reset cycle)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completion_reminder_sent_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completion_reminder_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;