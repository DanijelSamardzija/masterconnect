-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS search_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  category TEXT,
  city TEXT,
  language TEXT DEFAULT 'sr',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS search_subscriptions_unique_idx
  ON search_subscriptions (lower(email), COALESCE(lower(category), ''), COALESCE(lower(city), ''));

ALTER TABLE search_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert subscriptions"
  ON search_subscriptions FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own subscriptions"
  ON search_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own subscriptions"
  ON search_subscriptions FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role full access"
  ON search_subscriptions FOR ALL
  USING (true);
