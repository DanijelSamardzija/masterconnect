-- ============================================================
-- Initial Schema - Core tables that existed before migrations
-- ============================================================

-- Profiles table (references auth.users which Supabase creates automatically)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'customer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  city text NOT NULL,
  budget text,
  preferred_date text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Customers can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

-- Threads table
CREATE TABLE IF NOT EXISTS threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pro_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their threads"
  ON threads FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = pro_id);

CREATE POLICY "Users can create threads"
  ON threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id OR auth.uid() = pro_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = messages.thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );

CREATE POLICY "Thread participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = messages.thread_id
      AND (threads.customer_id = auth.uid() OR threads.pro_id = auth.uid())
    )
  );

-- Pro profiles table (legacy - later replaced by profiles.account_type)
CREATE TABLE IF NOT EXISTS pro_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bio text,
  city text,
  phone text,
  categories text[],
  avatar_url text,
  starting_price text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pro_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pro profiles are viewable by everyone"
  ON pro_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own pro profile"
  ON pro_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pro profile"
  ON pro_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_threads_customer_id ON threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_threads_pro_id ON threads(pro_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
