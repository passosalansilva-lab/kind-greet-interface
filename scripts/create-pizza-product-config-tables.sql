-- Migration: Create pizza configuration tables per product (not category)
-- This allows each pizza product to have its own sizes, doughs, and crusts

-- Table for pizza product sizes (per product, not category)
CREATE TABLE IF NOT EXISTS public.pizza_product_sizes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price numeric(10,2) DEFAULT 0,
  max_flavors integer DEFAULT 2,
  slices integer DEFAULT 8,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for pizza product doughs (per product)
CREATE TABLE IF NOT EXISTS public.pizza_product_doughs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  extra_price numeric(10,2) DEFAULT 0,
  is_required boolean DEFAULT true,
  max_selections integer DEFAULT 1,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for pizza product crust types (per product)
CREATE TABLE IF NOT EXISTS public.pizza_product_crust_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_required boolean DEFAULT false,
  max_selections integer DEFAULT 1,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for pizza product crust flavors (per product, linked to type)
CREATE TABLE IF NOT EXISTS public.pizza_product_crust_flavors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  crust_type_id uuid NOT NULL REFERENCES public.pizza_product_crust_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  extra_price numeric(10,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extend pizza_product_settings with dough/crust selection rules
ALTER TABLE public.pizza_product_settings
ADD COLUMN IF NOT EXISTS dough_max_selections integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS dough_is_required boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS crust_max_selections integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS crust_is_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS use_product_specific_config boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pizza_product_sizes_product ON public.pizza_product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_pizza_product_doughs_product ON public.pizza_product_doughs(product_id);
CREATE INDEX IF NOT EXISTS idx_pizza_product_crust_types_product ON public.pizza_product_crust_types(product_id);
CREATE INDEX IF NOT EXISTS idx_pizza_product_crust_flavors_product ON public.pizza_product_crust_flavors(product_id);
CREATE INDEX IF NOT EXISTS idx_pizza_product_crust_flavors_type ON public.pizza_product_crust_flavors(crust_type_id);

-- Enable RLS
ALTER TABLE public.pizza_product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_product_doughs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_product_crust_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_product_crust_flavors ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to manage their products)
CREATE POLICY "Users can manage pizza product sizes" ON public.pizza_product_sizes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage pizza product doughs" ON public.pizza_product_doughs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage pizza product crust types" ON public.pizza_product_crust_types
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage pizza product crust flavors" ON public.pizza_product_crust_flavors
  FOR ALL USING (true) WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.pizza_product_sizes IS 'Tamanhos de pizza específicos por produto';
COMMENT ON TABLE public.pizza_product_doughs IS 'Tipos de massa específicos por produto';
COMMENT ON TABLE public.pizza_product_crust_types IS 'Tipos de borda específicos por produto';
COMMENT ON TABLE public.pizza_product_crust_flavors IS 'Sabores de borda específicos por produto';
COMMENT ON COLUMN public.pizza_product_settings.use_product_specific_config IS 'Se true, usa configurações específicas do produto ao invés da categoria';
