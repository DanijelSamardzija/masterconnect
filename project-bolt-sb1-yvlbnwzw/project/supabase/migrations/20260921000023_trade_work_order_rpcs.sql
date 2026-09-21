-- Migration 023: Work Order RPCs.
--
-- Adds soft-delete columns to trade_jobs, then creates all RPCs for:
--   create_trade_job, update_trade_job, update_trade_job_status,
--   cancel_trade_job, get_trade_job, list_trade_jobs,
--   upsert_trade_material, delete_trade_material,
--   upsert_trade_expense, delete_trade_expense,
--   add_trade_photo, delete_trade_photo.
--
-- Security principles enforced in all RPCs:
--   • business_id never trusted from client: always resolved server-side from
--     the job/material/expense/photo being acted on
--   • purchase_price returned as NULL without can_view_purchase_prices
--   • financial summary fields returned as NULL without can_view_financials
--   • storage_path validated to start with {business_id}/{job_id}/ in add_trade_photo
--   • client_id / asset_id / assigned_to validated to same business

BEGIN;

-- ── Schema additions ──────────────────────────────────────────────────────────

ALTER TABLE public.trade_jobs
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Helper: resolve caller role + permissions for a business ──────────────────
-- Used inline in every RPC; no separate function needed since SECURITY DEFINER
-- RPCs already run in the definer's context.

-- ── create_trade_job ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_trade_job(
  p_business_id     UUID,
  p_title           TEXT,
  p_description     TEXT        DEFAULT NULL,
  p_client_id       UUID        DEFAULT NULL,
  p_asset_id        UUID        DEFAULT NULL,
  p_assigned_to     UUID        DEFAULT NULL,
  p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_end   TIMESTAMPTZ DEFAULT NULL,
  p_location        TEXT        DEFAULT NULL,
  p_notes           TEXT        DEFAULT NULL,
  p_priority        TEXT        DEFAULT 'normal',
  p_origin_type     TEXT        DEFAULT 'manual',
  p_origin_id       UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_role        TEXT;
  v_perms       JSONB;
  v_job_id      UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner', 'manager')
     AND NOT COALESCE((v_perms->>'can_create_manual_jobs')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF trim(p_title) = '' OR p_title IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'title_required');
  END IF;

  IF p_priority NOT IN ('low','normal','high','urgent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_priority');
  END IF;

  IF p_origin_type NOT IN ('manual','booking','request','emergency') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_origin_type');
  END IF;

  -- Validate client_id belongs to this business
  IF p_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_clients
      WHERE id = p_client_id AND business_id = p_business_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
    END IF;
  END IF;

  -- Validate asset_id belongs to this business
  IF p_asset_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_assets
      WHERE id = p_asset_id AND business_id = p_business_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'asset_not_found');
    END IF;
  END IF;

  -- Validate assigned_to is active staff of this business
  IF p_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_members
      WHERE business_id = p_business_id
        AND user_id = p_assigned_to
        AND is_active = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'assignee_not_found');
    END IF;
  END IF;

  INSERT INTO trade_jobs (
    business_id, title, description, client_id, asset_id,
    assigned_to, scheduled_start, scheduled_end, location,
    notes, priority, origin_type, origin_id, created_by
  ) VALUES (
    p_business_id, trim(p_title), p_description, p_client_id, p_asset_id,
    p_assigned_to, p_scheduled_start, p_scheduled_end, p_location,
    p_notes, p_priority, p_origin_type, p_origin_id, v_uid
  )
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('ok', true, 'id', v_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_trade_job(UUID,TEXT,TEXT,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated;

-- ── update_trade_job ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_trade_job(
  p_job_id          UUID,
  p_title           TEXT        DEFAULT NULL,
  p_description     TEXT        DEFAULT NULL,
  p_client_id       UUID        DEFAULT NULL,
  p_asset_id        UUID        DEFAULT NULL,
  p_assigned_to     UUID        DEFAULT NULL,
  p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_end   TIMESTAMPTZ DEFAULT NULL,
  p_actual_start    TIMESTAMPTZ DEFAULT NULL,
  p_actual_end      TIMESTAMPTZ DEFAULT NULL,
  p_location        TEXT        DEFAULT NULL,
  p_notes           TEXT        DEFAULT NULL,
  p_report_text     TEXT        DEFAULT NULL,
  p_priority        TEXT        DEFAULT NULL,
  p_clear_client    BOOLEAN     DEFAULT false,
  p_clear_asset     BOOLEAN     DEFAULT false,
  p_clear_assigned  BOOLEAN     DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_role        TEXT;
  v_perms       JSONB;
  v_can_edit    BOOLEAN;
  v_can_report  BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Resolve business_id from job (never trust client input)
  SELECT business_id INTO v_biz_id
  FROM trade_jobs
  WHERE id = p_job_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_edit   := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_create_manual_jobs')::boolean, false);
  v_can_report := v_role IN ('owner','manager')
                  OR COALESCE((v_perms->>'can_create_job_reports')::boolean, false);

  IF NOT v_can_edit AND NOT v_can_report THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_priority');
  END IF;

  -- Validate client_id if provided
  IF p_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_clients WHERE id = p_client_id AND business_id = v_biz_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
    END IF;
  END IF;

  -- Validate asset_id if provided
  IF p_asset_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_assets WHERE id = p_asset_id AND business_id = v_biz_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'asset_not_found');
    END IF;
  END IF;

  -- Validate assigned_to if provided
  IF p_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_members
      WHERE business_id = v_biz_id AND user_id = p_assigned_to AND is_active = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'assignee_not_found');
    END IF;
  END IF;

  UPDATE trade_jobs SET
    title           = CASE WHEN v_can_edit AND p_title IS NOT NULL    THEN trim(p_title)       ELSE title           END,
    description     = CASE WHEN v_can_edit AND p_description IS NOT NULL THEN p_description    ELSE description     END,
    client_id       = CASE WHEN v_can_edit AND p_clear_client          THEN NULL
                           WHEN v_can_edit AND p_client_id IS NOT NULL  THEN p_client_id       ELSE client_id       END,
    asset_id        = CASE WHEN v_can_edit AND p_clear_asset            THEN NULL
                           WHEN v_can_edit AND p_asset_id IS NOT NULL   THEN p_asset_id        ELSE asset_id        END,
    assigned_to     = CASE WHEN v_can_edit AND p_clear_assigned         THEN NULL
                           WHEN v_can_edit AND p_assigned_to IS NOT NULL THEN p_assigned_to    ELSE assigned_to     END,
    scheduled_start = CASE WHEN v_can_edit AND p_scheduled_start IS NOT NULL THEN p_scheduled_start ELSE scheduled_start END,
    scheduled_end   = CASE WHEN v_can_edit AND p_scheduled_end IS NOT NULL   THEN p_scheduled_end   ELSE scheduled_end   END,
    actual_start    = CASE WHEN v_can_report AND p_actual_start IS NOT NULL  THEN p_actual_start    ELSE actual_start    END,
    actual_end      = CASE WHEN v_can_report AND p_actual_end IS NOT NULL    THEN p_actual_end      ELSE actual_end      END,
    location        = CASE WHEN v_can_edit AND p_location IS NOT NULL   THEN p_location        ELSE location        END,
    notes           = CASE WHEN v_can_edit AND p_notes IS NOT NULL      THEN p_notes           ELSE notes           END,
    report_text     = CASE WHEN v_can_report AND p_report_text IS NOT NULL THEN p_report_text  ELSE report_text     END,
    priority        = CASE WHEN v_can_edit AND p_priority IS NOT NULL   THEN p_priority        ELSE priority        END
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_job(UUID,TEXT,TEXT,UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN) TO authenticated;

-- ── update_trade_job_status ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_trade_job_status(
  p_job_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('pending','confirmed','in_progress','completed','on_hold') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner','manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_jobs SET status = p_status WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_trade_job_status(UUID, TEXT) TO authenticated;

-- ── cancel_trade_job (soft delete) ────────────────────────────────────────────
-- Sets status = 'cancelled' and records who cancelled and when.
-- Hard-delete is intentionally not exposed via RPC.

CREATE OR REPLACE FUNCTION public.cancel_trade_job(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner','manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE trade_jobs
  SET status       = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_trade_job(UUID) TO authenticated;

-- ── get_trade_job ─────────────────────────────────────────────────────────────
-- Returns the full work order with nested materials, expenses, and photos.
-- Sensitive fields:
--   materials.purchase_price   → NULL if caller lacks can_view_purchase_prices
--   financial summary fields   → NULL if caller lacks can_view_financials

CREATE OR REPLACE FUNCTION public.get_trade_job(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_biz_id       UUID;
  v_role         TEXT;
  v_perms        JSONB;
  v_can_fin      BOOLEAN;
  v_can_purchase BOOLEAN;
  v_result       JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_can_fin      := v_role IN ('owner','manager')
                    OR COALESCE((v_perms->>'can_view_financials')::boolean, false);
  v_can_purchase := v_role IN ('owner','manager')
                    OR COALESCE((v_perms->>'can_view_purchase_prices')::boolean, false);

  SELECT
    jsonb_build_object(
      'ok',                  true,
      'id',                  j.id,
      'business_id',         j.business_id,
      'title',               j.title,
      'description',         j.description,
      'status',              j.status,
      'priority',            j.priority,
      'origin_type',         j.origin_type,
      'origin_id',           j.origin_id,
      'client_id',           j.client_id,
      'client_name',         tc.name,
      'asset_id',            j.asset_id,
      'asset_name',          ta.name,
      'assigned_to',         j.assigned_to,
      'assigned_name',       ap.name,
      'scheduled_start',     j.scheduled_start,
      'scheduled_end',       j.scheduled_end,
      'actual_start',        j.actual_start,
      'actual_end',          j.actual_end,
      'location',            j.location,
      'notes',               j.notes,
      'report_text',         j.report_text,
      'is_invoiced',         CASE WHEN v_can_fin THEN j.is_invoiced     ELSE NULL END,
      'invoice_amount',      CASE WHEN v_can_fin THEN j.invoice_amount  ELSE NULL END,
      'total_labor_cost',    CASE WHEN v_can_fin THEN j.total_labor_cost    ELSE NULL END,
      'total_materials_cost',CASE WHEN v_can_fin THEN j.total_materials_cost ELSE NULL END,
      'total_expenses',      CASE WHEN v_can_fin THEN j.total_expenses   ELSE NULL END,
      'cancelled_at',        j.cancelled_at,
      'created_by',          j.created_by,
      'created_at',          j.created_at,
      'updated_at',          j.updated_at,
      'materials', COALESCE(
        (SELECT jsonb_agg(
           jsonb_build_object(
             'id',             m.id,
             'name',           m.name,
             'quantity',       m.quantity,
             'unit',           m.unit,
             'sale_price',     m.sale_price,
             'purchase_price', CASE WHEN v_can_purchase THEN m.purchase_price ELSE NULL END,
             'supplier',       m.supplier,
             'notes',          m.notes,
             'added_by',       m.added_by,
             'created_at',     m.created_at
           ) ORDER BY m.created_at
         )
         FROM trade_job_materials m WHERE m.job_id = j.id
        ), '[]'::jsonb
      ),
      'expenses', COALESCE(
        (SELECT jsonb_agg(
           jsonb_build_object(
             'id',           e.id,
             'expense_type', e.expense_type,
             'description',  e.description,
             'amount',       e.amount,
             'receipt_path', e.receipt_path,
             'added_by',     e.added_by,
             'created_at',   e.created_at
           ) ORDER BY e.created_at
         )
         FROM trade_job_expenses e WHERE e.job_id = j.id
        ), '[]'::jsonb
      ),
      'photos', COALESCE(
        (SELECT jsonb_agg(
           jsonb_build_object(
             'id',           p2.id,
             'photo_type',   p2.photo_type,
             'storage_path', p2.storage_path,
             'caption',      p2.caption,
             'uploaded_by',  p2.uploaded_by,
             'created_at',   p2.created_at
           ) ORDER BY p2.created_at
         )
         FROM trade_job_photos p2 WHERE p2.job_id = j.id
        ), '[]'::jsonb
      )
    ) INTO v_result
  FROM trade_jobs j
  LEFT JOIN trade_clients     tc ON tc.id = j.client_id
  LEFT JOIN trade_assets      ta ON ta.id = j.asset_id
  LEFT JOIN profiles          ap ON ap.id = j.assigned_to
  WHERE j.id = p_job_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_job(UUID) TO authenticated;

-- ── list_trade_jobs ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_trade_jobs(
  p_business_id UUID,
  p_status      TEXT    DEFAULT NULL,
  p_client_id   UUID    DEFAULT NULL,
  p_limit       INT     DEFAULT 50,
  p_offset      INT     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   TEXT;
  v_total  BIGINT;
  v_jobs   JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = p_business_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM trade_jobs j
  WHERE j.business_id = p_business_id
    AND (p_status IS NULL    OR j.status    = p_status)
    AND (p_client_id IS NULL OR j.client_id = p_client_id);

  SELECT COALESCE(jsonb_agg(row ORDER BY row.scheduled_start ASC NULLS LAST, row.created_at DESC), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT jsonb_build_object(
      'id',              j.id,
      'title',           j.title,
      'status',          j.status,
      'priority',        j.priority,
      'client_id',       j.client_id,
      'client_name',     tc.name,
      'assigned_to',     j.assigned_to,
      'assigned_name',   ap.name,
      'scheduled_start', j.scheduled_start,
      'scheduled_end',   j.scheduled_end,
      'location',        j.location,
      'created_at',      j.created_at
    ) AS row
    FROM trade_jobs j
    LEFT JOIN trade_clients tc ON tc.id = j.client_id
    LEFT JOIN profiles      ap ON ap.id = j.assigned_to
    WHERE j.business_id = p_business_id
      AND (p_status IS NULL    OR j.status    = p_status)
      AND (p_client_id IS NULL OR j.client_id = p_client_id)
    ORDER BY j.scheduled_start ASC NULLS LAST, j.created_at DESC
    LIMIT  LEAST(p_limit, 200)
    OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'jobs', v_jobs);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trade_jobs(UUID,TEXT,UUID,INT,INT) TO authenticated;

-- ── upsert_trade_material ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_trade_material(
  p_job_id         UUID,
  p_name           TEXT,
  p_quantity       NUMERIC  DEFAULT 1,
  p_unit           TEXT     DEFAULT NULL,
  p_sale_price     NUMERIC  DEFAULT NULL,
  p_purchase_price NUMERIC  DEFAULT NULL,
  p_supplier       TEXT     DEFAULT NULL,
  p_notes          TEXT     DEFAULT NULL,
  p_material_id    UUID     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_role        TEXT;
  v_perms       JSONB;
  v_material_id UUID;
  v_purchase    NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_add_materials')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Only store purchase_price if caller has permission to view/set it
  v_purchase := CASE
    WHEN v_role IN ('owner','manager')
         OR COALESCE((v_perms->>'can_view_purchase_prices')::boolean, false)
    THEN p_purchase_price
    ELSE NULL
  END;

  IF p_material_id IS NOT NULL THEN
    -- Update: verify material belongs to this job/business
    IF NOT EXISTS (
      SELECT 1 FROM trade_job_materials
      WHERE id = p_material_id AND job_id = p_job_id AND business_id = v_biz_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'material_not_found');
    END IF;

    UPDATE trade_job_materials SET
      name           = p_name,
      quantity       = p_quantity,
      unit           = p_unit,
      sale_price     = p_sale_price,
      purchase_price = v_purchase,
      supplier       = p_supplier,
      notes          = p_notes
    WHERE id = p_material_id;

    RETURN jsonb_build_object('ok', true, 'id', p_material_id);
  ELSE
    INSERT INTO trade_job_materials (
      job_id, business_id, name, quantity, unit,
      sale_price, purchase_price, supplier, notes, added_by
    ) VALUES (
      p_job_id, v_biz_id, p_name, p_quantity, p_unit,
      p_sale_price, v_purchase, p_supplier, p_notes, v_uid
    )
    RETURNING id INTO v_material_id;

    RETURN jsonb_build_object('ok', true, 'id', v_material_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_material(UUID,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,UUID) TO authenticated;

-- ── delete_trade_material ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_material(
  p_material_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
  v_perms  JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_job_materials WHERE id = p_material_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'material_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_add_materials')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM trade_job_materials WHERE id = p_material_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_material(UUID) TO authenticated;

-- ── upsert_trade_expense ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_trade_expense(
  p_job_id       UUID,
  p_description  TEXT,
  p_expense_type TEXT     DEFAULT 'other',
  p_amount       NUMERIC  DEFAULT 0,
  p_receipt_path TEXT     DEFAULT NULL,
  p_expense_id   UUID     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_biz_id    UUID;
  v_role      TEXT;
  v_perms     JSONB;
  v_exp_id    UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_add_materials')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_expense_type NOT IN ('fuel','tool','subcontractor','parking','other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_expense_type');
  END IF;

  IF p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_expense_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM trade_job_expenses
      WHERE id = p_expense_id AND job_id = p_job_id AND business_id = v_biz_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'expense_not_found');
    END IF;

    UPDATE trade_job_expenses SET
      description  = p_description,
      expense_type = p_expense_type,
      amount       = p_amount,
      receipt_path = p_receipt_path
    WHERE id = p_expense_id;

    RETURN jsonb_build_object('ok', true, 'id', p_expense_id);
  ELSE
    INSERT INTO trade_job_expenses (
      job_id, business_id, description, expense_type, amount, receipt_path, added_by
    ) VALUES (
      p_job_id, v_biz_id, p_description, p_expense_type, p_amount, p_receipt_path, v_uid
    )
    RETURNING id INTO v_exp_id;

    RETURN jsonb_build_object('ok', true, 'id', v_exp_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_expense(UUID,TEXT,TEXT,NUMERIC,TEXT,UUID) TO authenticated;

-- ── delete_trade_expense ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_expense(
  p_expense_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
  v_perms  JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_job_expenses WHERE id = p_expense_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expense_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_add_materials')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM trade_job_expenses WHERE id = p_expense_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_expense(UUID) TO authenticated;

-- ── add_trade_photo ───────────────────────────────────────────────────────────
-- Registers a photo after the client has uploaded the file to the
-- trade-photos bucket.  Validates that storage_path actually belongs
-- to this job's business to prevent cross-tenant path injection.

CREATE OR REPLACE FUNCTION public.add_trade_photo(
  p_job_id       UUID,
  p_storage_path TEXT,
  p_photo_type   TEXT    DEFAULT 'during',
  p_caption      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_biz_id  UUID;
  v_role    TEXT;
  v_perms   JSONB;
  v_photo_id UUID;
  v_expected_prefix TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM trade_jobs WHERE id = p_job_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_create_job_reports')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_photo_type NOT IN ('before','during','after','document') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_photo_type');
  END IF;

  -- Validate path prefix: must be {business_id}/{job_id}/...
  v_expected_prefix := v_biz_id::text || '/' || p_job_id::text || '/';
  IF p_storage_path NOT LIKE (v_expected_prefix || '%') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_storage_path');
  END IF;

  INSERT INTO trade_job_photos (
    job_id, business_id, photo_type, storage_path, caption, uploaded_by
  ) VALUES (
    p_job_id, v_biz_id, p_photo_type, p_storage_path, p_caption, v_uid
  )
  RETURNING id INTO v_photo_id;

  RETURN jsonb_build_object('ok', true, 'id', v_photo_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_trade_photo(UUID,TEXT,TEXT,TEXT) TO authenticated;

-- ── delete_trade_photo ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_trade_photo(
  p_photo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
  v_perms  JSONB;
  v_path   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, storage_path INTO v_biz_id, v_path
  FROM trade_job_photos WHERE id = p_photo_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'photo_not_found');
  END IF;

  SELECT role, permissions INTO v_role, v_perms
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_role NOT IN ('owner','manager')
     AND NOT COALESCE((v_perms->>'can_create_job_reports')::boolean, false)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM trade_job_photos WHERE id = p_photo_id;

  -- Return storage_path so the client can also remove the file from the bucket
  RETURN jsonb_build_object('ok', true, 'storage_path', v_path);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trade_photo(UUID) TO authenticated;

COMMIT;
