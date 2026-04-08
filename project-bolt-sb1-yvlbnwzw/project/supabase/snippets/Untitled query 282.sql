 CREATE TABLE IF NOT EXISTS saved_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, post_id)
  );

  ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view their own saved posts" ON saved_posts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

  CREATE POLICY "Users can save posts" ON saved_posts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can unsave posts" ON saved_posts
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

  CREATE INDEX idx_saved_posts_user_id ON saved_posts(user_id);
  CREATE INDEX idx_saved_posts_post_id ON saved_posts(post_id);

  GRANT SELECT, INSERT, DELETE ON saved_posts TO authenticated;
