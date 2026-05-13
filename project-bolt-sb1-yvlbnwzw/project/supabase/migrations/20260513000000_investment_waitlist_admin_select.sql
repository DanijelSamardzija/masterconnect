-- Allow admins to read investment_waitlist entries
CREATE POLICY "investment_waitlist_admin_select" ON investment_waitlist
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to read investment_interests entries
CREATE POLICY "investment_interests_admin_select" ON investment_interests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to read all investment_projects (including hidden)
CREATE POLICY "investment_projects_admin_select" ON investment_projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
