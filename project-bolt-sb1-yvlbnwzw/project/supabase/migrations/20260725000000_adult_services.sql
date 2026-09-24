-- Adult Services — packages a creator can offer
-- Inquiry flow (Sprint 2B) will reference this table via adult_inquiries.service_id

CREATE TABLE IF NOT EXISTS adult_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  category      text NOT NULL CHECK (category IN (
                  'Photo', 'Video', 'Live Session', 'Chat', 'Custom', 'Event'
                )),
  price_credits integer NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  price_type    text NOT NULL DEFAULT 'fixed' CHECK (price_type IN (
                  'fixed', 'starting_from', 'hourly', 'negotiable'
                )),
  delivery_time text,
  delivery_type text NOT NULL DEFAULT 'delivered' CHECK (delivery_type IN (
                  'instant', 'scheduled', 'delivered'
                )),
  is_featured   boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adult_services_creator_id_idx ON adult_services(creator_id);
CREATE INDEX IF NOT EXISTS adult_services_is_featured_idx ON adult_services(is_featured) WHERE is_featured = true;

ALTER TABLE adult_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adult services are publicly readable"
  ON adult_services FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Creators manage own services"
  ON adult_services FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

GRANT SELECT ON adult_services TO public;
GRANT ALL ON adult_services TO service_role;
