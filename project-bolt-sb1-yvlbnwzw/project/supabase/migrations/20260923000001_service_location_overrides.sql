-- Per-location price overrides for service_catalog entries.
-- When a row exists here for (service_id, location_id), the booking page
-- and stats use this price/currency instead of service_catalog defaults.

CREATE TABLE IF NOT EXISTS public.service_location_overrides (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID        NOT NULL REFERENCES public.service_catalog(id)     ON DELETE CASCADE,
  location_id UUID        NOT NULL REFERENCES public.business_locations(id)  ON DELETE CASCADE,
  price       NUMERIC(10,2),
  price_type  TEXT        NOT NULL DEFAULT 'fixed'
              CHECK (price_type IN ('fixed', 'from', 'negotiable', 'free')),
  currency    TEXT        NOT NULL DEFAULT 'EUR',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, location_id)
);

ALTER TABLE public.service_location_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone can read (prices shown on public booking page)
CREATE POLICY "slo_public_read" ON public.service_location_overrides
  FOR SELECT USING (true);

-- Owner of the business can manage overrides for their own services
CREATE POLICY "slo_owner_write" ON public.service_location_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_catalog sc
      WHERE sc.id = service_id
        AND sc.business_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_catalog sc
      WHERE sc.id = service_id
        AND sc.business_id = auth.uid()
    )
  );

GRANT SELECT ON public.service_location_overrides TO anon, authenticated;
GRANT ALL    ON public.service_location_overrides TO service_role;

-- ── RPC: save all overrides for a service in one call ────────────────────────
-- Upserts provided overrides, deletes any existing row not in the list.
CREATE OR REPLACE FUNCTION public.save_service_location_overrides(
  p_service_id UUID,
  p_overrides  JSONB   -- array of {location_id, price, price_type, currency}
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Verify caller owns this service
  IF NOT EXISTS (
    SELECT 1 FROM service_catalog WHERE id = p_service_id AND business_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Delete overrides not in the new list
  DELETE FROM service_location_overrides
  WHERE service_id = p_service_id
    AND location_id NOT IN (
      SELECT (el->>'location_id')::UUID
      FROM jsonb_array_elements(p_overrides) AS el
    );

  -- Upsert each provided override
  INSERT INTO service_location_overrides (service_id, location_id, price, price_type, currency, updated_at)
  SELECT
    p_service_id,
    (el->>'location_id')::UUID,
    CASE WHEN el->>'price' IS NOT NULL AND el->>'price' != '' THEN (el->>'price')::NUMERIC ELSE NULL END,
    COALESCE(el->>'price_type', 'fixed'),
    COALESCE(el->>'currency', 'EUR'),
    now()
  FROM jsonb_array_elements(p_overrides) AS el
  ON CONFLICT (service_id, location_id) DO UPDATE SET
    price      = EXCLUDED.price,
    price_type = EXCLUDED.price_type,
    currency   = EXCLUDED.currency,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_service_location_overrides(UUID, JSONB) TO authenticated;
