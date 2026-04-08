DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'page_views' 
    AND policyname = 'Admin can read page_views'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can read page_views"
    ON page_views FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
      )
    )';
  END IF;
END $$;