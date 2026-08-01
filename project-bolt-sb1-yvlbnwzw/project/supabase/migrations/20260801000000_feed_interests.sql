-- Add feed_interests column to profiles for storing user category interests
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feed_interests text[] NOT NULL DEFAULT '{}';
