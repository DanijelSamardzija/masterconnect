/*
  # Create Reports Table for Content Moderation

  1. New Tables
    - `reports`
      - `id` (uuid, primary key)
      - `reporter_user_id` (uuid, references profiles) - who reported
      - `target_type` (text) - "post", "comment", or "profile"
      - `target_id` (uuid) - ID of the reported content
      - `target_owner_user_id` (uuid, references profiles) - who created the content
      - `reason` (text) - reason for report
      - `details` (text, nullable) - optional additional details
      - `status` (text) - "open", "reviewed", or "resolved" (default: "open")
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Unique constraint on (reporter_user_id, target_type, target_id) to prevent duplicate reports
    - Check constraint on target_type to only allow valid values
    - Check constraint on status to only allow valid values

  3. Security
    - Enable RLS
    - Users can insert their own reports
    - Users can read their own reports
    - Admins can read and update all reports
*/

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
  
  CONSTRAINT check_target_type CHECK (target_type IN ('post', 'comment', 'profile')),
  CONSTRAINT check_status CHECK (status IN ('open', 'reviewed', 'resolved')),
  CONSTRAINT unique_report_per_user UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own reports"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can view their own reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

CREATE POLICY "Admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.roles ? 'admin'
    )
  );

CREATE POLICY "Admins can update all reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.roles ? 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.roles ? 'admin'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'reports_updated_at'
  ) THEN
    CREATE FUNCTION update_reports_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER reports_updated_at
      BEFORE UPDATE ON reports
      FOR EACH ROW
      EXECUTE FUNCTION update_reports_updated_at();
  END IF;
END $$;