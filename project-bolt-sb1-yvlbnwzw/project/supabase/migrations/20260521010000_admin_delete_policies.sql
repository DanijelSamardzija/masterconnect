-- Allow admins to delete any post
CREATE POLICY "Admins can delete any post"
  ON posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Allow admins to delete any support message
CREATE POLICY "Admins can delete any support message"
  ON support_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Allow admins to delete any announcement
CREATE POLICY "Admins can delete any announcement"
  ON announcements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
