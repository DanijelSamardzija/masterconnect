/*
  # Add Reviews Table and Payment Status

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `pro_id` (uuid, foreign key to profiles) - The professional being reviewed
      - `customer_id` (uuid, foreign key to profiles) - The customer who wrote the review
      - `job_id` (uuid, foreign key to jobs) - The job being reviewed
      - `rating` (integer) - Star rating from 1 to 5
      - `comment` (text, optional) - Optional review text
      - `created_at` (timestamptz) - When the review was created

  2. Changes to `jobs` table
    - Add `payment_status` (text) - Payment status: "unpaid", "paid", etc.
    - Add `payment_placeholder_message_sent` (boolean) - Track if placeholder message was sent

  3. Security
    - Enable RLS on `reviews` table
    - Add policy for customers to create reviews for their own jobs
    - Add policy for authenticated users to read all reviews
    - Add policy for pros to read their own reviews
    - Add unique constraint: one review per job (customer can only review once per job)

  4. Important Notes
    - Reviews are for customers to review pros only (not the other way around)
    - Each job can have only one review from the customer
    - Rating must be between 1 and 5
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id)
);

-- Add payment status to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN payment_status text DEFAULT 'unpaid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'payment_placeholder_message_sent'
  ) THEN
    ALTER TABLE jobs ADD COLUMN payment_placeholder_message_sent boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS on reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can create reviews for their own jobs
CREATE POLICY "Customers can create reviews for their jobs"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_id 
      AND jobs.customer_id = auth.uid()
      AND jobs.status = 'completed'
    )
  );

-- Policy: Everyone can read reviews (public information)
CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Customers can read their own reviews
CREATE POLICY "Customers can read their own reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Policy: Pros can read reviews about them
CREATE POLICY "Pros can read reviews about them"
  ON reviews FOR SELECT
  TO authenticated
  USING (pro_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reviews_pro_id ON reviews(pro_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);