-- Habilita extensão pgcrypto para criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Função para criptografar texto usando extensions.pgcrypto
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'lovable_default_key_2024_secure');
  
  RETURN extensions.pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

-- Função para descriptografar texto
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := COALESCE(current_setting('app.settings.encryption_key', true), 'lovable_default_key_2024_secure');
  
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Adiciona colunas criptografadas à tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS telefone_encrypted bytea,
ADD COLUMN IF NOT EXISTS email_encrypted bytea,
ADD COLUMN IF NOT EXISTS endereco_encrypted bytea,
ADD COLUMN IF NOT EXISTS whatsapp_number_encrypted bytea,
ADD COLUMN IF NOT EXISTS website_encrypted bytea,
ADD COLUMN IF NOT EXISTS instagram_url_encrypted bytea;

-- Migra dados existentes para colunas criptografadas
UPDATE public.leads SET
  telefone_encrypted = public.encrypt_sensitive(telefone),
  email_encrypted = public.encrypt_sensitive(email),
  endereco_encrypted = public.encrypt_sensitive(endereco),
  whatsapp_number_encrypted = public.encrypt_sensitive(whatsapp_number),
  website_encrypted = public.encrypt_sensitive(website),
  instagram_url_encrypted = public.encrypt_sensitive(instagram_url)
WHERE (telefone IS NOT NULL AND telefone_encrypted IS NULL)
   OR (email IS NOT NULL AND email_encrypted IS NULL)
   OR (endereco IS NOT NULL AND endereco_encrypted IS NULL)
   OR (whatsapp_number IS NOT NULL AND whatsapp_number_encrypted IS NULL)
   OR (website IS NOT NULL AND website_encrypted IS NULL)
   OR (instagram_url IS NOT NULL AND instagram_url_encrypted IS NULL);

-- Limpa as colunas originais (dados sensíveis em texto plano)
UPDATE public.leads SET
  telefone = NULL,
  email = NULL,
  endereco = NULL,
  whatsapp_number = NULL,
  website = NULL,
  instagram_url = NULL
WHERE telefone_encrypted IS NOT NULL 
   OR email_encrypted IS NOT NULL
   OR endereco_encrypted IS NOT NULL
   OR whatsapp_number_encrypted IS NOT NULL
   OR website_encrypted IS NOT NULL
   OR instagram_url_encrypted IS NOT NULL;