-- Migration: Add dough and crust selection configuration to pizza_category_settings
-- This allows store owners to configure whether dough/crust selections are single or multiple

ALTER TABLE public.pizza_category_settings
ADD COLUMN IF NOT EXISTS dough_max_selections integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS dough_is_required boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS crust_max_selections integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS crust_is_required boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.pizza_category_settings.dough_max_selections IS 'Maximum number of dough types that can be selected (1 = single selection)';
COMMENT ON COLUMN public.pizza_category_settings.dough_is_required IS 'Whether dough selection is required';
COMMENT ON COLUMN public.pizza_category_settings.crust_max_selections IS 'Maximum number of crust flavors that can be selected (1 = single selection)';
COMMENT ON COLUMN public.pizza_category_settings.crust_is_required IS 'Whether crust selection is required';
