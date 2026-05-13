-- Allow anonymous (non-logged-in) users to insert page views
-- so public pages like /invest are tracked even without login.
CREATE POLICY "Anon users can insert page views"
  ON page_views FOR INSERT
  TO anon
  WITH CHECK (true);
