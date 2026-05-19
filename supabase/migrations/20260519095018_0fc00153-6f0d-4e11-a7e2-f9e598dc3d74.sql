ALTER TABLE public.organization_system_tags 
  ADD COLUMN IF NOT EXISTS price_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly'));