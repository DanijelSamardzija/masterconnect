-- Generic Inquiry System
-- Replaces adult_inquiries (migration not yet applied to production).
-- Inquiry system is payment-agnostic. Payment layer (Sprint 3) will reference
-- inquiries.id from a separate inquiry_payments table.

-- ─────────────────────────────────────────────────────────────
-- 1. Lookup table for subject types
--    Adding a new module = one INSERT. No ALTER TABLE ever needed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiry_subject_types (
  type        text PRIMARY KEY,
  label       text NOT NULL,
  module      text NOT NULL DEFAULT 'general',
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO inquiry_subject_types (type, label, module) VALUES
  ('adult_service', 'Adult Service', 'adult')
ON CONFLICT (type) DO NOTHING;

ALTER TABLE inquiry_subject_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subject types are publicly readable"
  ON inquiry_subject_types FOR SELECT TO public USING (true);

GRANT SELECT ON inquiry_subject_types TO public;
GRANT ALL    ON inquiry_subject_types TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. Generic inquiries table
--    No payment fields. Clean separation of concerns.
--    subject_meta stores a snapshot of the entity at inquiry time —
--    InquiryCard can render without joining the original entity table.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic reference (FK to lookup, no FK to entity table)
  subject_type text NOT NULL REFERENCES inquiry_subject_types(type),
  subject_id   uuid NOT NULL,
  subject_meta jsonb NOT NULL DEFAULT '{}',

  -- Participants
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Thread linkage (thread_type is set per-module: 'adult_inquiry', 'job_inquiry', …)
  thread_id    uuid REFERENCES threads(id) ON DELETE CASCADE,

  -- Core fields
  message      text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','expired','completed','cancelled')),

  -- Timestamps
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  responded_at timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_sender_id_idx    ON inquiries(sender_id);
CREATE INDEX IF NOT EXISTS inquiries_receiver_id_idx  ON inquiries(receiver_id);
CREATE INDEX IF NOT EXISTS inquiries_thread_id_idx    ON inquiries(thread_id);
CREATE INDEX IF NOT EXISTS inquiries_subject_type_idx ON inquiries(subject_type);
CREATE INDEX IF NOT EXISTS inquiries_status_idx       ON inquiries(status);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Participants can view their own inquiries
CREATE POLICY "Inquiry participants can view"
  ON inquiries FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Only senders can create
CREATE POLICY "Senders can create inquiries"
  ON inquiries FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Both participants can update status (app layer enforces business rules)
CREATE POLICY "Participants can update inquiry"
  ON inquiries FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

GRANT ALL ON inquiries TO service_role;
