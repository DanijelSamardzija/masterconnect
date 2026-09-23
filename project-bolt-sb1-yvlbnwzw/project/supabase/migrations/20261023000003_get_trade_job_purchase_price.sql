-- patch: add can_view_purchase_prices to get_trade_job response

CREATE OR REPLACE FUNCTION public.get_trade_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_biz_id   UUID;
  v_role     TEXT;
  v_perms    JSONB;
  v_can_fin  BOOLEAN;
  v_can_cli  BOOLEAN;
  v_can_rep  BOOLEAN;
  v_can_mat  BOOLEAN;
  v_can_price BOOLEAN;
  v_result   JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id FROM trade_jobs WHERE id = p_job_id LIMIT 1;
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

  v_can_fin   := v_role IN ('owner','manager') OR COALESCE((v_perms->>'can_view_financials')::boolean, false);
  v_can_cli   := v_role IN ('owner','manager') OR COALESCE((v_perms->>'can_view_client_records')::boolean, false);
  v_can_rep   := v_role IN ('owner','manager') OR COALESCE((v_perms->>'can_create_job_reports')::boolean, false);
  v_can_mat   := v_role IN ('owner','manager') OR COALESCE((v_perms->>'can_add_materials')::boolean, false);
  v_can_price := v_role IN ('owner','manager') OR COALESCE((v_perms->>'can_view_purchase_prices')::boolean, false);

  SELECT jsonb_build_object(
    'ok',  true,
    'can_view_client_records',   v_can_cli,
    'can_create_job_reports',    v_can_rep,
    'can_add_materials',         v_can_mat,
    'can_view_purchase_prices',  v_can_price,
    'job', jsonb_build_object(
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
      'eta_time',            j.eta_time,
      'on_the_way_at',       j.on_the_way_at,
      'location',            j.location,
      'notes',               j.notes,
      'report_text',         j.report_text,
      'is_invoiced',         CASE WHEN v_can_fin THEN j.is_invoiced     ELSE NULL END,
      'invoice_amount',      CASE WHEN v_can_fin THEN j.invoice_amount  ELSE NULL END,
      'total_labor_cost',    CASE WHEN v_can_fin THEN j.total_labor_cost     ELSE NULL END,
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
             'purchase_price', CASE WHEN v_can_price THEN m.purchase_price ELSE NULL END,
             'supplier',       m.supplier,
             'notes',          m.notes,
             'added_by',       m.added_by,
             'created_at',     m.created_at
           ) ORDER BY m.created_at
         )
         FROM trade_job_materials m WHERE m.job_id = j.id
        ), '[]'::jsonb
      ),
      'expenses', CASE WHEN v_can_fin THEN COALESCE(
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
      ) ELSE '[]'::jsonb END,
      'photos', COALESCE(
        (SELECT jsonb_agg(
           jsonb_build_object(
             'id',           p.id,
             'photo_type',   p.photo_type,
             'storage_path', p.storage_path,
             'caption',      p.caption,
             'uploaded_by',  p.uploaded_by,
             'created_at',   p.created_at
           ) ORDER BY p.created_at
         )
         FROM trade_job_photos p WHERE p.job_id = j.id
        ), '[]'::jsonb
      )
    )
  )
  INTO v_result
  FROM trade_jobs j
  LEFT JOIN trade_clients tc ON tc.id = j.client_id
  LEFT JOIN trade_assets  ta ON ta.id = j.asset_id
  LEFT JOIN profiles      ap ON ap.id = j.assigned_to
  WHERE j.id = p_job_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_job(UUID) TO authenticated;
