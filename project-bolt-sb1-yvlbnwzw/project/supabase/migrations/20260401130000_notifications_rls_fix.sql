-- Allow users to update and delete their own notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can update their notifications'
  ) THEN
    CREATE POLICY "Users can update their notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can delete their notifications'
  ) THEN
    CREATE POLICY "Users can delete their notifications"
      ON notifications FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
