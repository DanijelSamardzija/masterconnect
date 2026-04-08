/*
  # Add Recent Emojis Tracking to Profiles

  1. Changes
    - Add `recent_emojis` column to profiles table (jsonb array)
    - Stores up to 20 most recently used emojis per user
    - Defaults to empty array
    
  2. Important Notes
    - Stores emojis in most-recent-first order
    - Automatically deduplicates entries
    - Syncs with localStorage for offline support
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'recent_emojis'
  ) THEN
    ALTER TABLE profiles ADD COLUMN recent_emojis jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
