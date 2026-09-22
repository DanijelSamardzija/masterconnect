-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 032: Trade Linked Clients
-- Links trade_clients to GigZone accounts so owners/workers can send
-- documents (invoices, quotes, etc.) via the existing GigZone chat system.
-- The document content is never exposed through trade_custom_docs to the
-- client — it is sent as a file attachment in the regular messages flow.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add linked_user_id ────────────────────────────────────────────────────

ALTER TABLE public.trade_clients
  ADD COLUMN IF NOT EXISTS linked_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trade_clients_linked_user_idx
  ON public.trade_clients(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- ── 2. Update get_trade_client — include linked_user_id + linked_user_name ───

CREATE OR REPLACE FUNCTION public.get_trade_client(
  p_client_id UUID
)
RETURNS JSONB
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
    'id',               c.id,
    'business_id',      c.business_id,
    'name',             c.name,
    'phone',            c.phone,
    'email',            c.email,
    'whatsapp',         c.whatsapp,
    'viber',            c.viber,
    'address',          c.address,
    'notes',            c.notes,
    'tags',             c.tags,
    'linked_user_id',   c.linked_user_id,
    'linked_user_name', p.name,
    'created_at',       c.created_at,
    'updated_at',       c.updated_at,
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
  FROM trade_clients c
  LEFT JOIN profiles p ON p.id = c.linked_user_id
  WHERE c.id = p_client_id;

  RETURN jsonb_build_object('ok', true, 'data', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_client(UUID) TO authenticated;

-- ── 3. list_linked_trade_clients ─────────────────────────────────────────────
-- Returns clients of a business that have a linked GigZone account.
-- Used by the "Send document" modal to pick a recipient.

CREATE OR REPLACE FUNCTION public.list_linked_trade_clients(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT check_trade_business_access(p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  RETURN jsonb_build_object('ok', true, 'clients', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',               c.id,
          'name',             c.name,
          'linked_user_id',   c.linked_user_id,
          'linked_user_name', p.name
        )
        ORDER BY c.name
      )
      FROM trade_clients c
      JOIN profiles p ON p.id = c.linked_user_id
      WHERE c.business_id    = p_business_id
        AND c.linked_user_id IS NOT NULL
    ),
    '[]'::jsonb
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_linked_trade_clients(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_linked_trade_clients(UUID) TO   authenticated;

-- ── 4. link_trade_client_to_user ─────────────────────────────────────────────
-- Looks up a GigZone account by email and links it to a trade_client record.
-- Only active staff members of the business can call this.

CREATE OR REPLACE FUNCTION public.link_trade_client_to_user(
  p_client_id UUID,
  p_email     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_business_id UUID;
  v_user_id     UUID;
  v_user_name   TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id
  FROM trade_clients WHERE id = p_client_id;

  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;

  -- Look up GigZone account by email (profiles table mirrors auth.users)
  SELECT id, name INTO v_user_id, v_user_name
  FROM profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  UPDATE trade_clients
  SET linked_user_id = v_user_id,
      updated_at     = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id, 'name', v_user_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_trade_client_to_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.link_trade_client_to_user(UUID, TEXT) TO   authenticated;

-- ── 5. unlink_trade_client_from_user ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unlink_trade_client_from_user(
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_business_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_business_id
  FROM trade_clients WHERE id = p_client_id;

  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  IF NOT check_trade_business_access(v_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_clients
  SET linked_user_id = NULL,
      updated_at     = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlink_trade_client_from_user(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unlink_trade_client_from_user(UUID) TO   authenticated;
