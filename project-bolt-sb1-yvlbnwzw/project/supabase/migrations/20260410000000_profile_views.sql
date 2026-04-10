-- Profile views tracking table
CREATE TABLE IF NOT EXISTS profile_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for fast aggregation queries
CREATE INDEX idx_profile_views_profile_id ON profile_views(profile_id);
CREATE INDEX idx_profile_views_profile_viewed ON profile_views(profile_id, viewed_at DESC);

-- RLS
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated) can insert a view
CREATE POLICY "Authenticated users can insert profile views"
  ON profile_views FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Profile owner can read their own view stats
CREATE POLICY "Profile owner can read own view stats"
  ON profile_views FOR SELECT
  USING (profile_id = auth.uid());
