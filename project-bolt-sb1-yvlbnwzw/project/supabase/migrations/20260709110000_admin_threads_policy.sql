-- Allow admins to view all threads (bypasses participant-only RLS)
-- Without this, admin panel counts only admin's own conversations
CREATE POLICY "Admins can view all threads" ON threads
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
