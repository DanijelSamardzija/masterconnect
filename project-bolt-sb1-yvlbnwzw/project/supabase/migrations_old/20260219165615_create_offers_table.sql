/*
  # Create Offers Table for Job Offers

  1. New Tables
    - `offers`
      - `id` (uuid, primary key) - Unique offer ID
      - `conversation_id` (uuid, foreign key) - Reference to thread
      - `sender_id` (uuid, foreign key) - User sending the offer
      - `receiver_id` (uuid, foreign key) - User receiving the offer
      - `related_post_id` (uuid, foreign key) - Job seeker post ID
      - `price` (numeric) - Offer price amount
      - `currency` (text) - Currency code (RSD, EUR, USD)
      - `estimated_start` (date, nullable) - Optional start date
      - `duration_deadline` (text, nullable) - Optional duration/deadline
      - `note` (text, nullable) - Message note from sender
      - `status` (text) - Status: pending, accepted, declined
      - `created_at` (timestamptz) - When offer was created
      - `responded_at` (timestamptz, nullable) - When offer was accepted/declined
      - `message_id` (uuid, nullable) - Reference to the message that contains this offer

  2. Security
    - Enable RLS on `offers` table
    - Add policy for sender to view their sent offers
    - Add policy for receiver to view their received offers
    - Add policy for creating offers
    - Add policy for receiver to update offer status
*/

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  related_post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'RSD',
  estimated_start date,
  duration_deadline text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT valid_currency CHECK (currency IN ('RSD', 'EUR', 'USD'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offers_conversation ON offers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_offers_sender ON offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_offers_receiver ON offers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_offers_post ON offers(related_post_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- Enable RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Sender can view their sent offers
CREATE POLICY "Senders can view their sent offers"
  ON offers FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id);

-- Receiver can view their received offers
CREATE POLICY "Receivers can view their received offers"
  ON offers FOR SELECT
  TO authenticated
  USING (auth.uid() = receiver_id);

-- Authenticated users can create offers (they must be the sender)
CREATE POLICY "Users can create offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Receiver can update offer status (accept/decline)
CREATE POLICY "Receivers can update offer status"
  ON offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id AND status = 'pending')
  WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted', 'declined'));

-- Add message_type column to messages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'offer', 'system'));
  END IF;
END $$;

-- Add offer_id column to messages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN offer_id uuid REFERENCES offers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for offer messages
CREATE INDEX IF NOT EXISTS idx_messages_offer ON messages(offer_id) WHERE offer_id IS NOT NULL;