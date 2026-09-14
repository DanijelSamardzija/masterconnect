-- Food ordering system with modifiers (toppings) and optional delivery
-- Tables: menu_categories, menu_items, menu_modifier_groups, menu_modifier_options,
--         food_order_settings, food_orders, food_order_items

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID           REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name        TEXT           NOT NULL,
  description TEXT,
  price       NUMERIC(10,2)  NOT NULL,
  image_url   TEXT,
  is_active   BOOLEAN        NOT NULL DEFAULT true,
  sort_order  INTEGER        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Modifier groups per item (e.g. "Dodaci u pljeskavicu", "Umaci")
CREATE TABLE IF NOT EXISTS public.menu_modifier_groups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  selection_type TEXT        NOT NULL DEFAULT 'multiple', -- 'single' | 'multiple'
  is_required    BOOLEAN     NOT NULL DEFAULT false,
  min_selections INTEGER     NOT NULL DEFAULT 0,
  max_selections INTEGER,    -- NULL = no limit
  sort_order     INTEGER     NOT NULL DEFAULT 0
);

-- Modifier options (e.g. "Ketchup +0", "Ajvar +0.50", "Sir +1.00")
CREATE TABLE IF NOT EXISTS public.menu_modifier_options (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID           NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
  name        TEXT           NOT NULL,
  price_delta NUMERIC(10,2)  NOT NULL DEFAULT 0,
  is_active   BOOLEAN        NOT NULL DEFAULT true,
  sort_order  INTEGER        NOT NULL DEFAULT 0
);

-- Per-business delivery/pickup settings
CREATE TABLE IF NOT EXISTS public.food_order_settings (
  business_id            UUID           PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  offers_delivery        BOOLEAN        NOT NULL DEFAULT false,
  offers_pickup          BOOLEAN        NOT NULL DEFAULT true,
  delivery_fee           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  min_order_amount       NUMERIC(10,2)  NOT NULL DEFAULT 0,
  estimated_prep_minutes INTEGER        NOT NULL DEFAULT 30,
  currency               TEXT           NOT NULL DEFAULT 'BAM',
  is_accepting_orders    BOOLEAN        NOT NULL DEFAULT true,
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.food_orders (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id          UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name        TEXT,
  client_phone       TEXT,
  client_address     TEXT,          -- filled when order_type = 'delivery'
  order_type         TEXT           NOT NULL DEFAULT 'pickup', -- 'pickup' | 'delivery'
  subtotal           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  delivery_fee       NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_amount       NUMERIC(10,2)  NOT NULL,
  status             TEXT           NOT NULL DEFAULT 'pending',
  -- pending | accepted | preparing | ready | out_for_delivery | delivered | cancelled
  notes              TEXT,
  estimated_ready_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.food_order_items (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID           NOT NULL REFERENCES public.food_orders(id) ON DELETE CASCADE,
  item_id            UUID           REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name          TEXT           NOT NULL, -- snapshot at order time
  unit_price         NUMERIC(10,2)  NOT NULL, -- snapshot
  quantity           INTEGER        NOT NULL DEFAULT 1,
  selected_modifiers JSONB,         -- [{group_name, option_name, price_delta}]
  item_total         NUMERIC(10,2)  NOT NULL,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.menu_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifier_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifier_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_items       ENABLE ROW LEVEL SECURITY;

-- Business manages their own menu
CREATE POLICY "mc_business_all"  ON public.menu_categories       FOR ALL USING (business_id = auth.uid());
CREATE POLICY "mi_business_all"  ON public.menu_items            FOR ALL USING (business_id = auth.uid());
CREATE POLICY "mmg_business_all" ON public.menu_modifier_groups  FOR ALL USING (
  EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = item_id AND m.business_id = auth.uid())
);
CREATE POLICY "mmo_business_all" ON public.menu_modifier_options FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.menu_modifier_groups mg
    JOIN public.menu_items m ON m.id = mg.item_id
    WHERE mg.id = group_id AND m.business_id = auth.uid()
  )
);
CREATE POLICY "fos_business_all" ON public.food_order_settings FOR ALL USING (business_id = auth.uid());
CREATE POLICY "fo_business_all"  ON public.food_orders         FOR ALL USING (business_id = auth.uid());
CREATE POLICY "foi_business_all" ON public.food_order_items    FOR ALL USING (
  EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = order_id AND o.business_id = auth.uid())
);

-- Public can read active menu
CREATE POLICY "mc_public_select"  ON public.menu_categories      FOR SELECT USING (is_active = true);
CREATE POLICY "mi_public_select"  ON public.menu_items           FOR SELECT USING (is_active = true);
CREATE POLICY "mmg_public_select" ON public.menu_modifier_groups FOR SELECT USING (true);
CREATE POLICY "mmo_public_select" ON public.menu_modifier_options FOR SELECT USING (is_active = true);
CREATE POLICY "fos_public_select" ON public.food_order_settings   FOR SELECT USING (true);

-- Client manages their own orders
CREATE POLICY "fo_client_all"  ON public.food_orders      FOR ALL    USING (client_id = auth.uid());
CREATE POLICY "foi_client_sel" ON public.food_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = order_id AND o.client_id = auth.uid())
);
-- Anyone can place an order (guest checkout)
CREATE POLICY "fo_public_insert" ON public.food_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "foi_public_insert" ON public.food_order_items FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mc_business   ON public.menu_categories(business_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_mi_business   ON public.menu_items(business_id, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_mmg_item      ON public.menu_modifier_groups(item_id);
CREATE INDEX IF NOT EXISTS idx_mmo_group     ON public.menu_modifier_options(group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fo_business   ON public.food_orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fo_client     ON public.food_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_foi_order     ON public.food_order_items(order_id);
