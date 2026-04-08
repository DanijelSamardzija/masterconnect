-- Fix followers RLS: add explicit INSERT and DELETE policies with WITH CHECK
-- The FOR ALL policy may not properly cover INSERT in all Supabase versions

DROP POLICY IF EXISTS "Users can manage their follows" ON followers;

CREATE POLICY "Users can view followers" ON followers
  FOR SELECT TO public USING (true);

CREATE POLICY "Users can follow others" ON followers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON followers
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);
