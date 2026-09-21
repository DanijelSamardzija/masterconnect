-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: Trade Custom Docs
-- trade_custom_docs table + 5 SECURITY DEFINER RPCs
-- Access: owner/manager only (P5-A). Workers have no access.
-- rows JSONB stored in same record (P1-A). list_trade_custom_docs excludes rows.
-- CF-2 fix: created_by ON DELETE SET NULL (not CASCADE).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_custom_docs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES booking_profiles(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  doc_type    TEXT        NOT NULL DEFAULT 'table'
                CHECK (doc_type IN ('table','note','list')),
  title       TEXT        NOT NULL,
  description TEXT,
  schema      JSONB       NOT NULL DEFAULT '[]',
  rows        JSONB       NOT NULL DEFAULT '[]',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_custom_docs_business_id_idx
  ON public.trade_custom_docs (business_id);

CREATE INDEX IF NOT EXISTS trade_custom_docs_sort_order_idx
  ON public.trade_custom_docs (business_id, sort_order);

ALTER TABLE public.trade_custom_docs ENABLE ROW LEVEL SECURITY;

-- RLS: any authenticated staff member of the business can reach the row.
-- RPCs do the owner/manager gate on top of this.
CREATE POLICY trade_custom_docs_staff ON public.trade_custom_docs
  FOR ALL TO authenticated
  USING      (business_id IN (SELECT public.get_my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_my_business_ids()));

-- ── Helper: owner/manager check (inline in each RPC) ─────────────────────────
-- Each RPC queries staff_members for v_role and rejects if not owner/manager.

-- ── 2. list_trade_custom_docs ─────────────────────────────────────────────────
-- Returns metadata only — no rows column (P1-A performance requirement).

CREATE OR REPLACE FUNCTION public.list_trade_custom_docs(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role    TEXT;
  v_docs    JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT sm.role INTO v_role
    FROM staff_members sm
    JOIN booking_profiles bp ON bp.id = sm.business_id
   WHERE sm.business_id = p_business_id
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
     AND bp.is_active   = true
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',          d.id,
      'doc_type',    d.doc_type,
      'title',       d.title,
      'description', d.description,
      'schema',      d.schema,
      'row_count',   jsonb_array_length(d.rows),
      'sort_order',  d.sort_order,
      'created_at',  d.created_at,
      'updated_at',  d.updated_at
    ) ORDER BY d.sort_order ASC, d.created_at ASC
  ), '[]'::jsonb)
  INTO v_docs
  FROM trade_custom_docs d
  WHERE d.business_id = p_business_id;

  RETURN jsonb_build_object('ok', true, 'docs', v_docs);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trade_custom_docs(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_trade_custom_docs(UUID) FROM anon;

-- ── 3. get_trade_custom_doc ───────────────────────────────────────────────────
-- Returns single doc including rows.

CREATE OR REPLACE FUNCTION public.get_trade_custom_doc(
  p_doc_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_role      TEXT;
  v_business  UUID;
  v_doc       JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT d.business_id INTO v_business
    FROM trade_custom_docs d
   WHERE d.id = p_doc_id;

  IF v_business IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT sm.role INTO v_role
    FROM staff_members sm
   WHERE sm.business_id = v_business
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'id',          d.id,
    'business_id', d.business_id,
    'doc_type',    d.doc_type,
    'title',       d.title,
    'description', d.description,
    'schema',      d.schema,
    'rows',        d.rows,
    'sort_order',  d.sort_order,
    'created_at',  d.created_at,
    'updated_at',  d.updated_at
  ) INTO v_doc
  FROM trade_custom_docs d
  WHERE d.id = p_doc_id;

  RETURN jsonb_build_object('ok', true, 'doc', v_doc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_custom_doc(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trade_custom_doc(UUID) FROM anon;

-- ── 4. upsert_trade_custom_doc ────────────────────────────────────────────────
-- Creates or updates doc metadata (not rows — use save_doc_rows for rows).

CREATE OR REPLACE FUNCTION public.upsert_trade_custom_doc(
  p_business_id UUID,
  p_doc_id      UUID        DEFAULT NULL,
  p_title       TEXT        DEFAULT NULL,
  p_doc_type    TEXT        DEFAULT 'table',
  p_description TEXT        DEFAULT NULL,
  p_schema      JSONB       DEFAULT '[]',
  p_sort_order  INTEGER     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role    TEXT;
  v_doc_id  UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Input validation
  IF trim(COALESCE(p_title, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;
  IF p_doc_type NOT IN ('table','note','list') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_doc_type');
  END IF;

  SELECT sm.role INTO v_role
    FROM staff_members sm
    JOIN booking_profiles bp ON bp.id = sm.business_id
   WHERE sm.business_id = p_business_id
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
     AND bp.is_active   = true
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_doc_id IS NOT NULL THEN
    -- Update
    UPDATE trade_custom_docs
       SET title       = trim(p_title),
           doc_type    = p_doc_type,
           description = NULLIF(trim(COALESCE(p_description,'')), ''),
           schema      = COALESCE(p_schema, '[]'::jsonb),
           sort_order  = COALESCE(p_sort_order, sort_order),
           updated_at  = now()
     WHERE id          = p_doc_id
       AND business_id = p_business_id
    RETURNING id INTO v_doc_id;

    IF v_doc_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
  ELSE
    -- Insert
    INSERT INTO trade_custom_docs
      (business_id, created_by, doc_type, title, description, schema, sort_order)
    VALUES
      (p_business_id, v_user_id, p_doc_type, trim(p_title),
       NULLIF(trim(COALESCE(p_description,'')), ''),
       COALESCE(p_schema, '[]'::jsonb),
       COALESCE(p_sort_order, 0))
    RETURNING id INTO v_doc_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_custom_doc(UUID,UUID,TEXT,TEXT,TEXT,JSONB,INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_trade_custom_doc(UUID,UUID,TEXT,TEXT,TEXT,JSONB,INTEGER) FROM anon;

-- ── 5. save_doc_rows ──────────────────────────────────────────────────────────
-- Replaces all rows for a document. Validates max 1000 rows.

CREATE OR REPLACE FUNCTION public.save_doc_rows(
  p_doc_id UUID,
  p_rows   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_role     TEXT;
  v_business UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rows_must_be_array');
  END IF;

  IF jsonb_array_length(p_rows) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rows_limit_exceeded');
  END IF;

  SELECT d.business_id INTO v_business
    FROM trade_custom_docs d WHERE d.id = p_doc_id;

  IF v_business IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT sm.role INTO v_role
    FROM staff_members sm
   WHERE sm.business_id = v_business
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE trade_custom_docs
     SET rows       = p_rows,
         updated_at = now()
   WHERE id = p_doc_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_doc_rows(UUID,JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_doc_rows(UUID,JSONB) FROM anon;

-- ── 6. delete_trade_custom_doc ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_custom_doc(
  p_doc_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_role     TEXT;
  v_business UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT d.business_id INTO v_business
    FROM trade_custom_docs d WHERE d.id = p_doc_id;

  IF v_business IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT sm.role INTO v_role
    FROM staff_members sm
   WHERE sm.business_id = v_business
     AND sm.user_id     = v_user_id
     AND sm.is_active   = true
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM trade_custom_docs WHERE id = p_doc_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_custom_doc(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_trade_custom_doc(UUID) FROM anon;
