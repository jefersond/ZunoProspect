-- =====================================================
-- FIX: Remover função RPC duplicada que causa PGRST203
-- "Could not choose the best candidate function"
-- =====================================================

-- Dropar a versão antiga da função (com p_user_id text no final)
-- Esta é a assinatura problemática que causa ambiguidade
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(
  text,   -- p_encryption_key
  text,   -- p_nome  
  text,   -- p_cidade
  jsonb,  -- p_digital_signals
  text,   -- p_email
  text,   -- p_endereco
  text,   -- p_foco
  boolean,-- p_has_gtag
  boolean,-- p_has_gtm
  boolean,-- p_has_meta_pixel
  text,   -- p_instagram_url
  numeric,-- p_latitude
  numeric,-- p_longitude
  text,   -- p_nicho
  text,   -- p_pais
  boolean,-- p_proximidade_ativa
  integer,-- p_raio_km
  numeric,-- p_rating
  integer,-- p_total_reviews
  text,   -- p_website
  text,   -- p_whatsapp_number
  boolean,-- p_whatsapp_on_site
  text,   -- p_google_place_id
  text,   -- p_telefone
  text,   -- p_search_run_id
  uuid    -- p_user_id (no final - esta é a versão errada)
);

-- Também dropar qualquer outra variação que possa existir com p_user_id text
DROP FUNCTION IF EXISTS public.set_encryption_key_and_insert_lead(
  text, text, text, jsonb, text, text, text, text, boolean, boolean, boolean, 
  text, numeric, numeric, text, text, boolean, integer, numeric, integer, 
  text, text, boolean, text
);