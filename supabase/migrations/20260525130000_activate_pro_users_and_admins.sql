-- Migration to activate kiefferlinconts@gmail.com and change access to falecom@klsalescompany.com on the pro plan, with admin privileges.

-- 1. Update email of the existing user from 'kiefferlinconts@gmail.com' to 'falecom@klsalescompany.com' in auth.users if it exists
UPDATE auth.users
SET email = 'falecom@klsalescompany.com',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email": "falecom@klsalescompany.com"}'::jsonb
WHERE email = 'kiefferlinconts@gmail.com';

-- 2. Ensure both profiles exist and subscriptions are set to 'pro' (800 leads, 100 AI limit)
DO $$
DECLARE
  v_user_id_new uuid;
  v_user_id_old uuid;
BEGIN
  -- Get user IDs
  SELECT id INTO v_user_id_new FROM auth.users WHERE email = 'falecom@klsalescompany.com';
  SELECT id INTO v_user_id_old FROM auth.users WHERE email = 'kiefferlinconts@gmail.com';

  -- If new user exists, make sure they have a profile, a pro subscription, and admin role
  IF v_user_id_new IS NOT NULL THEN
    INSERT INTO public.profiles (id, nome_completo, created_at, updated_at)
    VALUES (v_user_id_new, 'KL Sales Company', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET nome_completo = 'KL Sales Company',
        updated_at = now();

    INSERT INTO public.user_subscriptions (
      user_id, plan_name, leads_limit, ai_limit, leads_used_this_month, ai_used_this_month, billing_period_start, billing_period_end, created_at, updated_at
    )
    VALUES (
      v_user_id_new, 'pro', 800, 100, 0, 0, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'pro',
        leads_limit = 800,
        ai_limit = 100,
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id_new, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- If old user exists (in case it wasn't updated or to be safe), make sure they have a profile, pro subscription, and admin role
  IF v_user_id_old IS NOT NULL THEN
    INSERT INTO public.profiles (id, nome_completo, created_at, updated_at)
    VALUES (v_user_id_old, 'Kieffer Linconts', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET nome_completo = 'Kieffer Linconts',
        updated_at = now();

    INSERT INTO public.user_subscriptions (
      user_id, plan_name, leads_limit, ai_limit, leads_used_this_month, ai_used_this_month, billing_period_start, billing_period_end, created_at, updated_at
    )
    VALUES (
      v_user_id_old, 'pro', 800, 100, 0, 0, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = 'pro',
        leads_limit = 800,
        ai_limit = 100,
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id_old, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- 3. Redefine is_admin function to support the new admin accounts
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_profile_admin boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(coalesce(u.email, ''))
  INTO v_email
  FROM auth.users u
  WHERE u.id = _user_id;

  IF v_email IN (
    'jeferson.zanotell@gmail.com', 
    'jefeson.zanotell@gmail.com', 
    'falecom@klsalescompany.com', 
    'kiefferlinconts@gmail.com'
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  ) INTO v_profile_admin;

  RETURN v_profile_admin;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    lower(coalesce(auth.email(), '')) IN (
      'jeferson.zanotell@gmail.com', 
      'jefeson.zanotell@gmail.com', 
      'falecom@klsalescompany.com', 
      'kiefferlinconts@gmail.com'
    )
    OR public.is_admin(auth.uid());
$$;

-- 4. Redefine handle_new_user trigger to recognize new admin accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN (
    'jeferson.zanotell@gmail.com', 
    'jefeson.zanotell@gmail.com', 
    'falecom@klsalescompany.com', 
    'kiefferlinconts@gmail.com'
  );
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

-- 5. Redefine handle_new_user_subscription trigger to assign correct starter / admin / free settings
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN (
    'jeferson.zanotell@gmail.com', 
    'jefeson.zanotell@gmail.com', 
    'falecom@klsalescompany.com', 
    'kiefferlinconts@gmail.com'
  );
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_name,
    leads_limit,
    ai_limit,
    leads_used_this_month,
    ai_used_this_month
  )
  VALUES (
    NEW.id,
    CASE WHEN v_is_admin THEN 'agencia' ELSE 'free' END,
    CASE WHEN v_is_admin THEN 999999 ELSE 20 END,
    CASE WHEN v_is_admin THEN 999999 ELSE 3 END,
    0,
    0
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan_name = CASE WHEN v_is_admin THEN 'agencia' ELSE 'free' END,
      leads_limit = CASE WHEN v_is_admin THEN 999999 ELSE 20 END,
      ai_limit = CASE WHEN v_is_admin THEN 999999 ELSE 3 END;

  RETURN NEW;
END;
$$;
