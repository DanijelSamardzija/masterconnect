-- ─────────────────────────────────────────────────────────────────────────────
-- Faza 4: Trade client RPCs
-- Tables: trade_clients, trade_assets
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: caller is active staff of business ──────────────────────────────

CREATE OR REPLACE FUNCTION public.check_trade_business_access(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_trade_business_access(UUID) TO authenticated;

-- ── create_trade_client ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_trade_client(
  p_business_id  UUID,
  p_name         TEXT,
  p_phone        TEXT   DEFAULT NULL,
  p_email        TEXT   DEFAULT NULL,
  p_whatsapp     TEXT   DEFAULT NULL,
  p_viber        TEXT   DEFAULT NULL,
  p_address      TEXT   DEFAULT NULL,
  p_notes        TEXT   DEFAULT NULL,
  p_tags         TEXT[] DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_client_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT check_trade_business_access(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  INSERT INTO trade_clients (
    business_id, name, phone, email, whatsapp, viber,
    address, notes, tags, created_by
  ) VALUES (
    p_business_id, trim(p_name), p_phone, p_email, p_whatsapp, p_viber,
    p_address, p_notes, COALESCE(p_tags, '{}'), v_uid
  )
  RETURNING id INTO v_client_id;

  RETURN jsonb_build_object('ok', true, 'id', v_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_trade_client(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ── update_trade_client ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_trade_client(
  p_client_id    UUID,
  p_name         TEXT,
  p_phone        TEXT   DEFAULT NULL,
  p_email        TEXT   DEFAULT NULL,
  p_whatsapp     TEXT   DEFAULT NULL,
  p_viber        TEXT   DEFAULT NULL,
  p_address      TEXT   DEFAULT NULL,
  p_notes        TEXT   DEFAULT NULL,
  p_tags         TEXT[] DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_business_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id FROM trade_clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_clients SET
    name       = trim(p_name),
    phone      = p_phone,
    email      = p_email,
    whatsapp   = p_whatsapp,
    viber      = p_viber,
    address    = p_address,
    notes      = p_notes,
    tags       = COALESCE(p_tags, '{}'),
    updated_at = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_client(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ── delete_trade_client ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_client(
  p_client_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_business_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id FROM trade_clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM trade_clients WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_client(UUID) TO authenticated;

-- ── search_trade_clients ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_trade_clients(
  p_business_id UUID,
  p_query       TEXT DEFAULT NULL,
  p_limit       INT  DEFAULT 50
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT check_trade_business_access(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         c.id,
          'name',       c.name,
          'phone',      c.phone,
          'email',      c.email,
          'address',    c.address,
          'tags',       c.tags,
          'created_at', c.created_at
        )
        ORDER BY c.name
      )
      FROM trade_clients c
      WHERE c.business_id = p_business_id
        AND (
          p_query IS NULL
          OR trim(p_query) = ''
          OR c.name    ILIKE '%' || trim(p_query) || '%'
          OR c.phone   ILIKE '%' || trim(p_query) || '%'
          OR c.email   ILIKE '%' || trim(p_query) || '%'
          OR c.address ILIKE '%' || trim(p_query) || '%'
        )
      LIMIT p_limit
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_trade_clients(UUID, TEXT, INT) TO authenticated;

-- ── get_trade_client ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_client(
  p_client_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_business_id UUID;
  v_result      JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id FROM trade_clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT jsonb_build_object(
    'id',          c.id,
    'business_id', c.business_id,
    'name',        c.name,
    'phone',       c.phone,
    'email',       c.email,
    'whatsapp',    c.whatsapp,
    'viber',       c.viber,
    'address',     c.address,
    'notes',       c.notes,
    'tags',        c.tags,
    'created_at',  c.created_at,
    'updated_at',  c.updated_at,
    'assets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',          a.id,
            'name',        a.name,
            'asset_type',  a.asset_type,
            'description', a.description,
            'location',    a.location,
            'created_at',  a.created_at
          )
          ORDER BY a.created_at DESC
        )
        FROM trade_assets a WHERE a.client_id = c.id
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM trade_clients c WHERE c.id = p_client_id;

  RETURN jsonb_build_object('ok', true, 'data', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_client(UUID) TO authenticated;

-- ── get_trade_client_history ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_client_history(
  p_client_id   UUID,
  p_business_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT check_trade_business_access(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',              j.id,
          'title',           j.title,
          'status',          j.status,
          'priority',        j.priority,
          'scheduled_start', j.scheduled_start,
          'actual_start',    j.actual_start,
          'actual_end',      j.actual_end,
          'invoice_amount',  j.invoice_amount,
          'is_invoiced',     j.is_invoiced,
          'created_at',      j.created_at
        )
        ORDER BY j.created_at DESC
      )
      FROM trade_jobs j
      WHERE j.client_id = p_client_id
        AND j.business_id = p_business_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_client_history(UUID, UUID) TO authenticated;

-- ── upsert_trade_asset ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_trade_asset(
  p_business_id UUID,
  p_client_id   UUID,
  p_name        TEXT,
  p_asset_type  TEXT DEFAULT 'other',
  p_description TEXT DEFAULT NULL,
  p_location    TEXT DEFAULT NULL,
  p_asset_id    UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_result_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT check_trade_business_access(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_asset_id IS NOT NULL THEN
    UPDATE trade_assets SET
      name        = trim(p_name),
      asset_type  = p_asset_type,
      description = p_description,
      location    = p_location,
      updated_at  = now()
    WHERE id = p_asset_id AND business_id = p_business_id;
    v_result_id := p_asset_id;
  ELSE
    INSERT INTO trade_assets (business_id, client_id, name, asset_type, description, location)
    VALUES (p_business_id, p_client_id, trim(p_name), p_asset_type, p_description, p_location)
    RETURNING id INTO v_result_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_asset(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ── delete_trade_asset ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_asset(
  p_asset_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_business_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id FROM trade_assets WHERE id = p_asset_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM trade_assets WHERE id = p_asset_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_asset(UUID) TO authenticated;
