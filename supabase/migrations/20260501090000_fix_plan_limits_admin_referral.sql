-- Fix plan limits, admin detection, Google profile creation and referral credits.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS buscas_saldo INTEGER NOT NULL DEFAULT 10;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
ON public.profiles(referral_code)
WHERE referral_code IS NOT NULL;

UPDATE public.profiles
SET buscas_saldo = 10
WHERE buscas_saldo IS NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    LOOP
      v_code := 'ref_' || substr(md5(NEW.id::text || clock_timestamp()::text || random()::text), 1, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE referral_code = v_code
          AND id <> NEW.id
      );
    END LOOP;

    NEW.referral_code := v_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_referral_code ON public.profiles;
CREATE TRIGGER ensure_referral_code
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

CREATE OR REPLACE FUNCTION public.process_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  referral_code_used text;
BEGIN
  SELECT raw_user_meta_data->>'referred_by_code'
  INTO referral_code_used
  FROM auth.users
  WHERE id = NEW.id;

  IF referral_code_used IS NOT NULL AND referral_code_used <> '' THEN
    SELECT id
    INTO referrer_id
    FROM public.profiles
    WHERE referral_code = referral_code_used
    LIMIT 1;

    IF referrer_id IS NOT NULL AND referrer_id <> NEW.id THEN
      NEW.referred_by := referrer_id;
      UPDATE public.profiles
      SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100,
          updated_at = now()
      WHERE id = referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_reward ON public.profiles;
CREATE TRIGGER on_profile_created_reward
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.process_referral_reward();

CREATE OR REPLACE FUNCTION public.process_referral_reward_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL THEN
    IF NEW.referred_by <> NEW.id THEN
      UPDATE public.profiles
      SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100,
          updated_at = now()
      WHERE id = NEW.referred_by;
    ELSE
      NEW.referred_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update_reward ON public.profiles;
CREATE TRIGGER on_profile_update_reward
BEFORE UPDATE OF referred_by ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.process_referral_reward_on_update();

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_user_id uuid, p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 10 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT id
  INTO referrer_id
  FROM public.profiles
  WHERE referral_code = trim(p_referral_code)
  LIMIT 1;

  IF referrer_id IS NULL OR referrer_id = p_user_id THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET referred_by = referrer_id,
      updated_at = now()
  WHERE id = p_user_id
    AND referred_by IS NULL;

  RETURN found;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com');
BEGIN
  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN v_is_admin THEN 999999 ELSE 10 END
  )
  ON CONFLICT (id) DO UPDATE
  SET nome_completo = COALESCE(EXCLUDED.nome_completo, public.profiles.nome_completo),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      buscas_saldo = CASE WHEN v_is_admin THEN 999999 ELSE COALESCE(public.profiles.buscas_saldo, EXCLUDED.buscas_saldo) END,
      updated_at = now();

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com');
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (
    NEW.id,
    CASE WHEN v_is_admin THEN 'agencia' ELSE 'starter' END,
    CASE WHEN v_is_admin THEN -1 ELSE 10 END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_name = CASE WHEN v_is_admin THEN 'agencia' ELSE public.user_subscriptions.plan_name END,
      leads_limit = CASE WHEN v_is_admin THEN -1 ELSE COALESCE(NULLIF(public.user_subscriptions.leads_limit, 0), EXCLUDED.leads_limit) END,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_subscription();

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(COALESCE(u.email, '')) IN ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com')
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id uuid)
RETURNS TABLE(
  plan_name text,
  leads_limit integer,
  leads_used integer,
  leads_remaining integer,
  billing_period_end timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  PERFORM public.reset_monthly_leads_count();

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 10 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  v_is_admin := public.is_admin(p_user_id);

  IF v_is_admin THEN
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
    VALUES (p_user_id, 'agencia', -1)
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'agencia',
        leads_limit = -1,
        updated_at = now();

    RETURN QUERY
    SELECT
      'admin'::text,
      -1::integer,
      COALESCE(s.leads_used_this_month, 0)::integer,
      -1::integer,
      COALESCE(s.billing_period_end, date_trunc('month', now()) + interval '1 month')
    FROM public.user_subscriptions s
    WHERE s.user_id = p_user_id;

    RETURN;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (p_user_id, 'starter', 10)
  ON CONFLICT (user_id) DO UPDATE
  SET leads_limit = COALESCE(NULLIF(public.user_subscriptions.leads_limit, 0), EXCLUDED.leads_limit),
      updated_at = now()
  WHERE public.user_subscriptions.leads_limit IS NULL
     OR public.user_subscriptions.leads_limit = 0;

  RETURN QUERY
  SELECT
    s.plan_name,
    COALESCE(NULLIF(s.leads_limit, 0), 10) AS leads_limit,
    COALESCE(s.leads_used_this_month, 0) AS leads_used,
    CASE
      WHEN s.leads_limit = -1 THEN -1
      ELSE GREATEST(COALESCE(NULLIF(s.leads_limit, 0), 10) - COALESCE(s.leads_used_this_month, 0), 0)
    END AS leads_remaining,
    s.billing_period_end
  FROM public.user_subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id uuid, p_count integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_remaining integer;
  v_bonus integer;
  v_bonus_to_use integer;
BEGIN
  IF p_count <= 0 THEN
    RETURN true;
  END IF;

  PERFORM public.reset_monthly_leads_count();

  INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_admin(u.id) THEN 999999 ELSE 10 END
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  IF public.is_admin(p_user_id) THEN
    INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit, leads_used_this_month)
    VALUES (p_user_id, 'agencia', -1, p_count)
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'agencia',
        leads_limit = -1,
        leads_used_this_month = COALESCE(public.user_subscriptions.leads_used_this_month, 0) + p_count,
        updated_at = now();
    RETURN true;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit)
  VALUES (p_user_id, 'starter', 10)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT COALESCE(NULLIF(leads_limit, 0), 10), COALESCE(leads_used_this_month, 0)
  INTO v_limit, v_used
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF v_limit = -1 THEN
    UPDATE public.user_subscriptions
    SET leads_used_this_month = COALESCE(leads_used_this_month, 0) + p_count,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  v_remaining := GREATEST(v_limit - v_used, 0);
  v_bonus_to_use := GREATEST(p_count - v_remaining, 0);

  SELECT COALESCE(buscas_saldo, 0)
  INTO v_bonus
  FROM public.profiles
  WHERE id = p_user_id;

  v_bonus := COALESCE(v_bonus, 0);

  IF v_bonus_to_use > v_bonus THEN
    RETURN false;
  END IF;

  IF v_bonus_to_use > 0 THEN
    UPDATE public.profiles
    SET buscas_saldo = GREATEST(COALESCE(buscas_saldo, 0) - v_bonus_to_use, 0),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  UPDATE public.user_subscriptions
  SET leads_used_this_month = COALESCE(leads_used_this_month, 0) + p_count,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

UPDATE public.profiles
SET referral_code = 'ref_' || substr(md5(id::text || clock_timestamp()::text || random()::text), 1, 8)
WHERE referral_code IS NULL OR referral_code = '';

INSERT INTO public.profiles (id, nome_completo, avatar_url, buscas_saldo)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url',
  999999
FROM auth.users u
WHERE lower(COALESCE(u.email, '')) = 'jeferson.zanotell@gmail.com'
ON CONFLICT (id) DO UPDATE
SET buscas_saldo = 999999,
    updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(COALESCE(email, '')) = 'jeferson.zanotell@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_subscriptions (user_id, plan_name, leads_limit, leads_used_this_month)
SELECT id, 'agencia', -1, 0
FROM auth.users
WHERE lower(COALESCE(email, '')) = 'jeferson.zanotell@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET plan_name = 'agencia',
    leads_limit = -1,
    updated_at = now();

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = id);

DROP POLICY IF EXISTS "Admin can view leads" ON public.leads;
DROP POLICY IF EXISTS "Admin can create leads" ON public.leads;
DROP POLICY IF EXISTS "Admin can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admin can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios leads" ON public.leads;
CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can create own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin or own subscription view" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admin or own subscription insert" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.user_subscriptions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscription" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admins can update subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin can view interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Admin can create interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Admin can update interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Admin can delete interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can view own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can create own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can update own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can delete own interacoes" ON public.interacoes;
CREATE POLICY "Users can view own interacoes" ON public.interacoes FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can create own interacoes" ON public.interacoes FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can update own interacoes" ON public.interacoes FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can delete own interacoes" ON public.interacoes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Admin can create templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Admin can update templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Admin can delete templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can view own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can create own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can update own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates_mensagens;
CREATE POLICY "Users can view own templates" ON public.templates_mensagens FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.templates_mensagens FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.templates_mensagens FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.templates_mensagens FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Admin can create campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Admin can update campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Admin can delete campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can view own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can create own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can update own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can delete own campanhas" ON public.campanhas;
CREATE POLICY "Users can view own campanhas" ON public.campanhas FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can create own campanhas" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can update own campanhas" ON public.campanhas FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can delete own campanhas" ON public.campanhas FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Admin can create leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Admin can update leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Admin can delete leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can view own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can insert own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can update own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can delete own leads_campanhas" ON public.leads_campanhas;
CREATE POLICY "Users can view own leads_campanhas" ON public.leads_campanhas FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid()));
CREATE POLICY "Users can insert own leads_campanhas" ON public.leads_campanhas FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid()));
CREATE POLICY "Users can update own leads_campanhas" ON public.leads_campanhas FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid()));
CREATE POLICY "Users can delete own leads_campanhas" ON public.leads_campanhas FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can view api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admin can create api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admin can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admin can delete api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys" ON public.api_keys;
CREATE POLICY "Users can view own api_keys" ON public.api_keys FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can create own api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can update own api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Users can delete own api_keys" ON public.api_keys FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);
