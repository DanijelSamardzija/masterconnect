-- ============================================================
-- MasterConnect - Complete Schema (matches production DB)
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'customer',
  email text NOT NULL DEFAULT '',
  phone text,
  recent_emojis jsonb DEFAULT '[]'::jsonb,
  bio text,
  skills jsonb DEFAULT '[]'::jsonb,
  city text,
  avatar_url text,
  cover_url text,
  account_type text NOT NULL,
  is_admin boolean DEFAULT false,
  category text,
  average_rating numeric,
  review_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly viewable" ON profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- pro_profiles (legacy table, still in use)
CREATE TABLE IF NOT EXISTS pro_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bio text DEFAULT '',
  city text DEFAULT '',
  phone text DEFAULT '',
  categories text[] DEFAULT '{}',
  avatar_url text,
  starting_price text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pro_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pro profiles are publicly viewable" ON pro_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own pro profile" ON pro_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pro profile" ON pro_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- jobs
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  city text NOT NULL,
  budget text,
  preferred_date text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_requested boolean DEFAULT false,
  completion_requested_at timestamptz,
  completion_request_dismissed_at timestamptz,
  completion_reminder_sent_at timestamptz,
  payment_status text DEFAULT 'unpaid',
  payment_placeholder_message_sent boolean DEFAULT false,
  job_type text DEFAULT 'project',
  category_normalized text
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view jobs" ON jobs FOR SELECT TO public USING (true);
CREATE POLICY "Customers can create jobs" ON jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can update their jobs" ON jobs FOR UPDATE TO authenticated USING (auth.uid() = customer_id);

-- job_images
CREATE TABLE IF NOT EXISTS job_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view job images" ON job_images FOR SELECT TO public USING (true);
CREATE POLICY "Job owners can manage images" ON job_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_images.job_id AND jobs.customer_id = auth.uid()));

-- threads
CREATE TABLE IF NOT EXISTS threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  user1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  thread_type text NOT NULL DEFAULT 'direct',
  post_id uuid
);

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view threads" ON threads FOR SELECT TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create threads" ON threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- offers (before messages, messages references offers)
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  related_post_id uuid,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'RSD',
  estimated_start date,
  duration_deadline text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  message_id uuid,
  offer_type text NOT NULL DEFAULT 'job',
  price_type text DEFAULT 'fixed'
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offer participants can view offers" ON offers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create offers" ON offers FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their offers" ON offers FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_system boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  seen_at timestamptz,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz,
  message_type text DEFAULT 'text',
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  system_message_type text
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread participants can view messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM threads WHERE threads.id = messages.thread_id
    AND (threads.user1_id = auth.uid() OR threads.user2_id = auth.uid())));
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their messages" ON messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);

-- message_attachments
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Message participants can view attachments" ON message_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add attachments" ON message_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- message_reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view message reactions" ON message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their reactions" ON message_reactions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- thread_participants
CREATE TABLE IF NOT EXISTS thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  last_read_at timestamptz
);

ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their thread participants" ON thread_participants FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM threads WHERE threads.id = thread_participants.thread_id
    AND (threads.user1_id = auth.uid() OR threads.user2_id = auth.uid())));
CREATE POLICY "Users can manage thread participants" ON thread_participants FOR ALL TO authenticated USING (auth.uid() = user_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'message',
  title text NOT NULL,
  body text NOT NULL,
  meta jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  post_id uuid,
  action_type text
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_pinned boolean DEFAULT false,
  pinned_at timestamptz,
  post_type text NOT NULL,
  profession text,
  experience_level text,
  location text,
  availability text,
  is_active boolean DEFAULT true,
  category_normalized text,
  category text,
  city text,
  job_title text,
  price_type text,
  price_value numeric,
  min_price numeric,
  max_price numeric,
  currency text NOT NULL DEFAULT 'RSD',
  spam_score integer DEFAULT 0,
  status text DEFAULT 'published',
  rank_penalty numeric DEFAULT 1.0,
  duplicate_hash text,
  link_count integer DEFAULT 0,
  phone_count integer DEFAULT 0,
  hashtag_count integer DEFAULT 0,
  caps_ratio numeric DEFAULT 0,
  moderation_reasons text[] DEFAULT '{}',
  pinned boolean
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT TO public USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their posts" ON posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their posts" ON posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- post_media
CREATE TABLE IF NOT EXISTS post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  width integer,
  height integer,
  thumbnail_url text,
  overlay_text text,
  overlay_color text,
  overlay_x numeric DEFAULT 50,
  overlay_y numeric DEFAULT 50,
  overlay_width numeric DEFAULT 80,
  overlay_align text DEFAULT 'center',
  overlay_font_size numeric DEFAULT 32
);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post media" ON post_media FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their post media" ON post_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM posts WHERE posts.id = post_media.post_id AND posts.user_id = auth.uid()));

-- post_reactions
CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  reaction_type text DEFAULT 'like',
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post reactions" ON post_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their reactions" ON post_reactions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- post_comments
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  parent_comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON post_comments FOR SELECT TO public USING (true);
CREATE POLICY "Users can create comments" ON post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comment_reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comment reactions" ON comment_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their comment reactions" ON comment_reactions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pro_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are publicly viewable" ON reviews FOR SELECT TO public USING (true);
CREATE POLICY "Customers can create reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

-- blocks
CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their blocks" ON blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_user_id);
CREATE POLICY "Users can manage their blocks" ON blocks FOR ALL TO authenticated USING (auth.uid() = blocker_user_id);

-- reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_owner_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (reporter_user_id, target_type, target_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_user_id);
CREATE POLICY "Admins can view reports" ON reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- support_messages
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  category text DEFAULT 'other',
  attachment_url text,
  attachment_name text
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their support messages" ON support_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create support messages" ON support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- followers
CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view followers" ON followers FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their follows" ON followers FOR ALL TO authenticated USING (auth.uid() = follower_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_threads_user1_id ON threads(user1_id);
CREATE INDEX IF NOT EXISTS idx_threads_user2_id ON threads(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_id ON thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id ON thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_messages_updated_at
  BEFORE UPDATE ON support_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  user_name text;
  user_account_type text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer');

  INSERT INTO public.profiles (id, name, email, account_type, role, created_at)
  VALUES (NEW.id, user_name, NEW.email, user_account_type, user_account_type, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update average_rating on profiles
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = OLD.pro_id),
      review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = OLD.pro_id)
    WHERE id = OLD.pro_id;
  ELSE
    UPDATE profiles SET
      average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = NEW.pro_id),
      review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = NEW.pro_id)
    WHERE id = NEW.pro_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_rating_after_review
  AFTER INSERT OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION update_profile_rating();
