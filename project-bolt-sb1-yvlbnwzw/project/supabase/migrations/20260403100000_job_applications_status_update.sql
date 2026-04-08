-- Allow post owners to update application status (accept/decline)
CREATE POLICY "Post owners can update application status" ON job_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = job_applications.post_id
        AND posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = job_applications.post_id
        AND posts.user_id = auth.uid()
    )
  );
