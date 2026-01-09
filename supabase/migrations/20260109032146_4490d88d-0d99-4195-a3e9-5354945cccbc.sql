-- 1. Criar tabela de preços por quantidade de leads
CREATE TABLE public.lead_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL,
  leads_quantity INTEGER NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_annual NUMERIC(10,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_name, leads_quantity)
);

-- 2. Enable RLS
ALTER TABLE public.lead_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- 3. Política de leitura pública para preços
CREATE POLICY "Preços podem ser lidos por todos"
ON public.lead_pricing_tiers
FOR SELECT
TO anon, authenticated
USING (active = true);

-- 4. Adicionar coluna leads_package na tabela de subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS leads_package INTEGER DEFAULT 100;

-- 5. Atualizar usuários existentes para usar leads_limit como leads_package
UPDATE public.user_subscriptions
SET leads_package = CASE 
  WHEN leads_limit > 0 AND leads_limit != -1 THEN leads_limit
  ELSE 100
END
WHERE leads_package IS NULL OR leads_package = 100;

-- 6. Inserir preços para todos os planos e quantidades
-- Fórmula: preco_base + ((leads - 100) / 50) * 23.50
-- Preços base: Iniciante=47, Pro=97, Agencia=147

-- Iniciante (base R$47)
INSERT INTO public.lead_pricing_tiers (plan_name, leads_quantity, price_monthly, price_annual) VALUES
('starter', 100, 47.00, 470.00),
('starter', 150, 70.50, 705.00),
('starter', 200, 94.00, 940.00),
('starter', 250, 117.50, 1175.00),
('starter', 300, 141.00, 1410.00),
('starter', 350, 164.50, 1645.00),
('starter', 400, 188.00, 1880.00),
('starter', 450, 211.50, 2115.00),
('starter', 500, 235.00, 2350.00),
('starter', 600, 282.00, 2820.00),
('starter', 700, 329.00, 3290.00),
('starter', 800, 376.00, 3760.00),
('starter', 900, 423.00, 4230.00),
('starter', 1000, 470.00, 4700.00),
('starter', 1500, 705.00, 7050.00),
('starter', 2000, 940.00, 9400.00);

-- Pro (base R$97)
INSERT INTO public.lead_pricing_tiers (plan_name, leads_quantity, price_monthly, price_annual) VALUES
('pro', 100, 97.00, 970.00),
('pro', 150, 120.50, 1205.00),
('pro', 200, 144.00, 1440.00),
('pro', 250, 167.50, 1675.00),
('pro', 300, 191.00, 1910.00),
('pro', 350, 214.50, 2145.00),
('pro', 400, 238.00, 2380.00),
('pro', 450, 261.50, 2615.00),
('pro', 500, 285.00, 2850.00),
('pro', 600, 332.00, 3320.00),
('pro', 700, 379.00, 3790.00),
('pro', 800, 426.00, 4260.00),
('pro', 900, 473.00, 4730.00),
('pro', 1000, 520.00, 5200.00),
('pro', 1500, 755.00, 7550.00),
('pro', 2000, 990.00, 9900.00);

-- Agência (base R$147)
INSERT INTO public.lead_pricing_tiers (plan_name, leads_quantity, price_monthly, price_annual) VALUES
('agencia', 100, 147.00, 1470.00),
('agencia', 150, 170.50, 1705.00),
('agencia', 200, 194.00, 1940.00),
('agencia', 250, 217.50, 2175.00),
('agencia', 300, 241.00, 2410.00),
('agencia', 350, 264.50, 2645.00),
('agencia', 400, 288.00, 2880.00),
('agencia', 450, 311.50, 3115.00),
('agencia', 500, 335.00, 3350.00),
('agencia', 600, 382.00, 3820.00),
('agencia', 700, 429.00, 4290.00),
('agencia', 800, 476.00, 4760.00),
('agencia', 900, 523.00, 5230.00),
('agencia', 1000, 570.00, 5700.00),
('agencia', 1500, 805.00, 8050.00),
('agencia', 2000, 1040.00, 10400.00);