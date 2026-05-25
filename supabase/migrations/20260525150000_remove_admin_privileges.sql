-- Migration to remove admin privileges from falecom@klsalescompany.com and kiefferlinconts@gmail.com
-- Reverting the is_admin functions and new user triggers to only recognize the original admins

-- 1. Remove admin role from public.user_roles for both emails
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('falecom@klsalescompany.com', 'kiefferlinconts@gmail.com')
) AND role = 'admin'::public.app_role;

-- 2. Update their profile.buscas_saldo if they were boosted to 999999 as admins
UPDATE public.profiles
SET buscas_saldo = 0
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('falecom@klsalescompany.com', 'kiefferlinconts@gmail.com')
) AND buscas_saldo = 999999;

-- 3. Redefine is_admin function to ONLY recognize original admin emails
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
    'jefeson.zanotell@gmail.com'
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
      'jefeson.zanotell@gmail.com'
    )
    OR public.is_admin(auth.uid());
$$;

-- 4. Redefine handle_new_user trigger to ONLY recognize original admin accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN (
    'jeferson.zanotell@gmail.com', 
    'jefeson.zanotell@gmail.com'
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

-- 5. Redefine handle_new_user_subscription trigger to ONLY recognize original admin accounts
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := lower(COALESCE(NEW.email, '')) IN (
    'jeferson.zanotell@gmail.com', 
    'jefeson.zanotell@gmail.com'
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
