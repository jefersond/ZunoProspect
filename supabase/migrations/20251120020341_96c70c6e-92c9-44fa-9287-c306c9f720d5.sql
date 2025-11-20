-- Adicionar campos para sinais digitais detectados no site
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS whatsapp_on_site boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS has_meta_pixel boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_gtag boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_gtm boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS instagram_context text,
ADD COLUMN IF NOT EXISTS digital_signals jsonb;