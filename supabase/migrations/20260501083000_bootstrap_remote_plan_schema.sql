-- Bootstrap the partially migrated Supabase project without dropping data.
-- This makes the remote schema compatible with the app before plan/referral fixes run.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo text,
  empresa text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nome_completo text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS buscas_saldo integer DEFAULT 10;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET nome_completo = COALESCE(nome_completo, first_name)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'company_name'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET empresa = COALESCE(empresa, company_name)';
  END IF;
END;
$$;

UPDATE public.profiles SET buscas_saldo = 10 WHERE buscas_saldo IS NULL;
ALTER TABLE public.profiles ALTER COLUMN buscas_saldo SET DEFAULT 10;
ALTER TABLE public.profiles ALTER COLUMN buscas_saldo SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  cidade text,
  nicho text,
  foco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS nicho text,
  ADD COLUMN IF NOT EXISTS foco text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_on_site boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_meta_pixel boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_gtag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_gtm boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_signals jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnostico_bullets jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS probabilidade_conversao integer,
  ADD COLUMN IF NOT EXISTS plano_prospeccao jsonb,
  ADD COLUMN IF NOT EXISTS ai_analise_gerada_em timestamptz,
  ADD COLUMN IF NOT EXISTS proximidade_ativa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS raio_km integer,
  ADD COLUMN IF NOT EXISTS salvo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_context text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_responsavel text,
  ADD COLUMN IF NOT EXISTS cnpj_telefone text,
  ADD COLUMN IF NOT EXISTS cnpj_email text,
  ADD COLUMN IF NOT EXISTS situacao_cadastral text,
  ADD COLUMN IF NOT EXISTS porte_empresa text,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS search_run_id uuid,
  ADD COLUMN IF NOT EXISTS telefone_encrypted bytea,
  ADD COLUMN IF NOT EXISTS email_encrypted bytea,
  ADD COLUMN IF NOT EXISTS endereco_encrypted bytea,
  ADD COLUMN IF NOT EXISTS website_encrypted bytea,
  ADD COLUMN IF NOT EXISTS whatsapp_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS instagram_url_encrypted bytea,
  ADD COLUMN IF NOT EXISTS cnpj_telefone_encrypted bytea,
  ADD COLUMN IF NOT EXISTS cnpj_email_encrypted bytea;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company_name'
  ) THEN
    EXECUTE 'UPDATE public.leads SET nome = COALESCE(nome, company_name)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'whatsapp'
  ) THEN
    EXECUTE 'UPDATE public.leads SET whatsapp_number = COALESCE(whatsapp_number, whatsapp)';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT 'starter',
  leads_limit integer NOT NULL DEFAULT 10,
  leads_used_this_month integer NOT NULL DEFAULT 0,
  billing_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  billing_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  is_annual boolean NOT NULL DEFAULT false,
  leads_package integer,
  usa_addon boolean DEFAULT false,
  usa_addon_active_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS leads_package integer,
  ADD COLUMN IF NOT EXISTS usa_addon boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS usa_addon_active_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_annual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  ADD COLUMN IF NOT EXISTS billing_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  ADD COLUMN IF NOT EXISTS leads_used_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nota',
  conteudo text NOT NULL DEFAULT '',
  data_interacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.templates_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'whatsapp',
  assunto text,
  conteudo text NOT NULL,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativa',
  data_inicio timestamptz,
  data_fim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, campanha_id)
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_preview text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_run_id ON public.leads(search_run_id);
CREATE INDEX IF NOT EXISTS idx_leads_google_place_user ON public.leads(user_id, google_place_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_bootstrap ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS bytea
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN plain_text IS NULL THEN NULL ELSE convert_to(plain_text, 'UTF8') END
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data bytea)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN encrypted_data IS NULL THEN NULL ELSE convert_from(encrypted_data, 'UTF8') END
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_leads_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET leads_used_this_month = 0,
      billing_period_start = date_trunc('month', now()),
      billing_period_end = date_trunc('month', now()) + interval '1 month',
      updated_at = now()
  WHERE billing_period_end <= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_insert_lead(
  p_encryption_key text,
  p_nome text,
  p_cidade text,
  p_digital_signals jsonb,
  p_email text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_foco text DEFAULT NULL,
  p_google_place_id text DEFAULT NULL,
  p_has_gtag boolean DEFAULT false,
  p_has_gtm boolean DEFAULT false,
  p_has_meta_pixel boolean DEFAULT false,
  p_instagram_url text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_nicho text DEFAULT NULL,
  p_pais text DEFAULT 'BR',
  p_proximidade_ativa boolean DEFAULT false,
  p_raio_km integer DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_total_reviews integer DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_whatsapp_on_site boolean DEFAULT false,
  p_telefone text DEFAULT NULL,
  p_search_run_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_user_id uuid;
  v_is_new boolean := true;
BEGIN
  PERFORM set_config('app.leads_key', COALESCE(p_encryption_key, ''), true);
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  IF p_google_place_id IS NOT NULL THEN
    SELECT id
    INTO v_lead_id
    FROM public.leads
    WHERE user_id = v_user_id
      AND google_place_id = p_google_place_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    v_is_new := false;

    UPDATE public.leads
    SET nome = COALESCE(p_nome, nome),
        cidade = COALESCE(p_cidade, cidade),
        digital_signals = COALESCE(p_digital_signals, digital_signals),
        email = COALESCE(p_email, email),
        email_encrypted = CASE WHEN p_email IS NOT NULL AND p_email <> '' THEN public.encrypt_sensitive(p_email) ELSE email_encrypted END,
        endereco = COALESCE(p_endereco, endereco),
        endereco_encrypted = CASE WHEN p_endereco IS NOT NULL AND p_endereco <> '' THEN public.encrypt_sensitive(p_endereco) ELSE endereco_encrypted END,
        foco = COALESCE(p_foco, foco),
        has_gtag = COALESCE(p_has_gtag, has_gtag),
        has_gtm = COALESCE(p_has_gtm, has_gtm),
        has_meta_pixel = COALESCE(p_has_meta_pixel, has_meta_pixel),
        instagram_url = COALESCE(p_instagram_url, instagram_url),
        instagram_url_encrypted = CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url <> '' THEN public.encrypt_sensitive(p_instagram_url) ELSE instagram_url_encrypted END,
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        nicho = COALESCE(p_nicho, nicho),
        pais = COALESCE(p_pais, pais),
        proximidade_ativa = COALESCE(p_proximidade_ativa, proximidade_ativa),
        raio_km = COALESCE(p_raio_km, raio_km),
        rating = COALESCE(p_rating, rating),
        total_reviews = COALESCE(p_total_reviews, total_reviews),
        website = COALESCE(p_website, website),
        website_encrypted = CASE WHEN p_website IS NOT NULL AND p_website <> '' THEN public.encrypt_sensitive(p_website) ELSE website_encrypted END,
        whatsapp_number = COALESCE(p_whatsapp_number, whatsapp_number),
        whatsapp_number_encrypted = CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number <> '' THEN public.encrypt_sensitive(p_whatsapp_number) ELSE whatsapp_number_encrypted END,
        whatsapp_on_site = COALESCE(p_whatsapp_on_site, whatsapp_on_site),
        telefone = COALESCE(p_telefone, telefone),
        telefone_encrypted = CASE WHEN p_telefone IS NOT NULL AND p_telefone <> '' THEN public.encrypt_sensitive(p_telefone) ELSE telefone_encrypted END,
        search_run_id = COALESCE(p_search_run_id, search_run_id),
        updated_at = now()
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      nome, cidade, digital_signals, email, email_encrypted, endereco,
      endereco_encrypted, foco, google_place_id, has_gtag, has_gtm,
      has_meta_pixel, instagram_url, instagram_url_encrypted, latitude,
      longitude, nicho, pais, proximidade_ativa, raio_km, rating,
      total_reviews, user_id, website, website_encrypted, whatsapp_number,
      whatsapp_number_encrypted, whatsapp_on_site, telefone, telefone_encrypted,
      search_run_id
    )
    VALUES (
      p_nome, p_cidade, COALESCE(p_digital_signals, '{}'::jsonb), p_email,
      CASE WHEN p_email IS NOT NULL AND p_email <> '' THEN public.encrypt_sensitive(p_email) ELSE NULL END,
      p_endereco,
      CASE WHEN p_endereco IS NOT NULL AND p_endereco <> '' THEN public.encrypt_sensitive(p_endereco) ELSE NULL END,
      p_foco, p_google_place_id, COALESCE(p_has_gtag, false), COALESCE(p_has_gtm, false),
      COALESCE(p_has_meta_pixel, false), p_instagram_url,
      CASE WHEN p_instagram_url IS NOT NULL AND p_instagram_url <> '' THEN public.encrypt_sensitive(p_instagram_url) ELSE NULL END,
      p_latitude, p_longitude, p_nicho, COALESCE(p_pais, 'BR'),
      COALESCE(p_proximidade_ativa, false), p_raio_km, p_rating,
      COALESCE(p_total_reviews, 0), v_user_id, p_website,
      CASE WHEN p_website IS NOT NULL AND p_website <> '' THEN public.encrypt_sensitive(p_website) ELSE NULL END,
      p_whatsapp_number,
      CASE WHEN p_whatsapp_number IS NOT NULL AND p_whatsapp_number <> '' THEN public.encrypt_sensitive(p_whatsapp_number) ELSE NULL END,
      COALESCE(p_whatsapp_on_site, false), p_telefone,
      CASE WHEN p_telefone IS NOT NULL AND p_telefone <> '' THEN public.encrypt_sensitive(p_telefone) ELSE NULL END,
      p_search_run_id
    )
    RETURNING id INTO v_lead_id;
  END IF;

  RETURN json_build_object('id', v_lead_id, 'is_new', v_is_new, 'success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_encryption_key_and_get_leads_filtered(
  p_encryption_key text,
  p_user_id uuid DEFAULT NULL,
  p_search_run_id uuid DEFAULT NULL,
  p_salvo boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nome text,
  endereco text,
  telefone text,
  email text,
  website text,
  google_place_id text,
  rating numeric,
  total_reviews integer,
  cidade text,
  latitude numeric,
  longitude numeric,
  nicho text,
  foco text,
  status text,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  pais text,
  whatsapp_number text,
  instagram_url text,
  whatsapp_on_site boolean,
  has_meta_pixel boolean,
  has_gtag boolean,
  has_gtm boolean,
  digital_signals jsonb,
  diagnostico_bullets jsonb,
  probabilidade_conversao integer,
  plano_prospeccao jsonb,
  ai_analise_gerada_em timestamptz,
  proximidade_ativa boolean,
  raio_km integer,
  salvo boolean,
  instagram_context text,
  cnpj text,
  razao_social text,
  nome_responsavel text,
  cnpj_telefone text,
  cnpj_email text,
  situacao_cadastral text,
  porte_empresa text,
  cnae_principal text,
  search_run_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  PERFORM set_config('app.leads_key', COALESCE(p_encryption_key, ''), true);
  v_user_id := COALESCE(p_user_id, auth.uid());

  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.nome,
    l.endereco,
    COALESCE(public.decrypt_sensitive(l.telefone_encrypted), l.telefone),
    COALESCE(public.decrypt_sensitive(l.email_encrypted), l.email),
    COALESCE(public.decrypt_sensitive(l.website_encrypted), l.website),
    l.google_place_id,
    l.rating,
    l.total_reviews,
    l.cidade,
    l.latitude,
    l.longitude,
    l.nicho,
    l.foco,
    l.status,
    l.notas,
    l.created_at,
    l.updated_at,
    l.pais,
    COALESCE(public.decrypt_sensitive(l.whatsapp_number_encrypted), l.whatsapp_number),
    COALESCE(public.decrypt_sensitive(l.instagram_url_encrypted), l.instagram_url),
    l.whatsapp_on_site,
    l.has_meta_pixel,
    l.has_gtag,
    l.has_gtm,
    l.digital_signals,
    l.diagnostico_bullets,
    l.probabilidade_conversao,
    l.plano_prospeccao,
    l.ai_analise_gerada_em,
    l.proximidade_ativa,
    l.raio_km,
    l.salvo,
    l.instagram_context,
    l.cnpj,
    l.razao_social,
    l.nome_responsavel,
    COALESCE(public.decrypt_sensitive(l.cnpj_telefone_encrypted), l.cnpj_telefone),
    COALESCE(public.decrypt_sensitive(l.cnpj_email_encrypted), l.cnpj_email),
    l.situacao_cadastral,
    l.porte_empresa,
    l.cnae_principal,
    l.search_run_id
  FROM public.leads l
  WHERE (v_user_id IS NULL OR l.user_id = v_user_id)
    AND (p_search_run_id IS NULL OR l.search_run_id = p_search_run_id)
    AND (p_salvo IS NULL OR l.salvo = p_salvo)
  ORDER BY l.created_at DESC;
END;
$$;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_mensagens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_campanhas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_encryption_key_and_insert_lead(text, text, text, jsonb, text, text, text, text, boolean, boolean, boolean, text, numeric, numeric, text, text, boolean, integer, numeric, integer, uuid, text, text, boolean, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_encryption_key_and_get_leads_filtered(text, uuid, uuid, boolean) TO authenticated, service_role;
