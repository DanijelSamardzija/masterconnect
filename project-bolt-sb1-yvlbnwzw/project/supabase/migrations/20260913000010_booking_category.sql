-- Add booking_category column to profiles
-- Values: 'appointment' | 'restaurant' | 'food_order' | 'tradespeople' | 'accommodation'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_category TEXT;
