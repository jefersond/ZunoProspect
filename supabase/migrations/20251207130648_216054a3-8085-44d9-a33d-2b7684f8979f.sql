-- Remove plain text columns from leads table
-- All data is already stored in encrypted columns (*_encrypted)
-- This migration removes the security vulnerability of having plain text sensitive data

-- Drop the plain text columns
ALTER TABLE public.leads DROP COLUMN IF EXISTS telefone;
ALTER TABLE public.leads DROP COLUMN IF EXISTS email;
ALTER TABLE public.leads DROP COLUMN IF EXISTS endereco;
ALTER TABLE public.leads DROP COLUMN IF EXISTS whatsapp_number;
ALTER TABLE public.leads DROP COLUMN IF EXISTS website;
ALTER TABLE public.leads DROP COLUMN IF EXISTS instagram_url;

-- Note: The following encrypted columns remain and are used by the application:
-- - telefone_encrypted
-- - email_encrypted
-- - endereco_encrypted
-- - whatsapp_number_encrypted
-- - website_encrypted
-- - instagram_url_encrypted
-- 
-- Data access is done through the get_leads_decrypted and get_leads_decrypted_filtered
-- RPC functions which decrypt data on the fly for authorized users only.