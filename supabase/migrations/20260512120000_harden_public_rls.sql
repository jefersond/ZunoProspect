-- Harden public schema RLS without deleting data.
-- Safe to run once in the Supabase SQL Editor for project ihtltqxxlvbsxbiacbpr.

create or replace function public.is_admin(_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_profile_admin boolean := false;
begin
  if _user_id is null then
    return false;
  end if;

  select lower(coalesce(u.email, ''))
  into v_email
  from auth.users u
  where u.id = _user_id;

  if v_email in ('jeferson.zanotell@gmail.com', 'jefeson.zanotell@gmail.com') then
    return true;
  end if;

  if to_regclass('public.user_roles') is not null then
    if exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.role::text = 'admin'
    ) then
      return true;
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'is_admin'
    ) then
      execute 'select exists (select 1 from public.profiles where id = $1 and coalesce(is_admin, false) = true)'
      into v_profile_admin
      using _user_id;
      if v_profile_admin then
        return true;
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'role'
    ) then
      execute 'select exists (select 1 from public.profiles where id = $1 and lower(coalesce(role::text, '''')) = ''admin'')'
      into v_profile_admin
      using _user_id;
      if v_profile_admin then
        return true;
      end if;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    lower(coalesce(auth.email(), '')) = 'jeferson.zanotell@gmail.com'
    or public.is_admin(auth.uid());
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'leads',
    'saved_leads',
    'user_usage',
    'user_subscriptions',
    'subscriptions',
    'user_addons',
    'referrals',
    'search_logs',
    'email_events',
    'email_logs',
    'interacoes',
    'templates_mensagens',
    'campanhas',
    'campaigns',
    'leads_campanhas',
    'reports',
    'api_keys',
    'email_campaigns',
    'email_queue',
    'email_unsubscribes',
    'email_ab_tests',
    'email_ab_results',
    'onboarding_emails_sent',
    'welcome_emails_sent',
    'email_job_locks',
    'payment_events',
    'app_events',
    'security_events',
    'leads_access_log',
    'leads_audit_log',
    'email_logs_access_audit',
    'user_roles',
    'plans',
    'pricing',
    'public_config',
    'app_config',
    'lead_pricing_tiers',
    'templates_globais'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists "Users can view own profile" on public.profiles;
    drop policy if exists "Users can insert own profile" on public.profiles;
    drop policy if exists "Users can update own profile" on public.profiles;
    drop policy if exists "Users can delete own profile" on public.profiles;
    create policy "Users can view own profile" on public.profiles
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = id);
    create policy "Users can insert own profile" on public.profiles
      for insert to authenticated with check (public.is_admin(auth.uid()) or auth.uid() = id);
    create policy "Users can update own profile" on public.profiles
      for update to authenticated using (public.is_admin(auth.uid()) or auth.uid() = id)
      with check (public.is_admin(auth.uid()) or auth.uid() = id);
    create policy "Users can delete own profile" on public.profiles
      for delete to authenticated using (public.is_admin(auth.uid()) or auth.uid() = id);
  end if;

  if to_regclass('public.leads') is not null then
    drop policy if exists "Users can view own leads" on public.leads;
    drop policy if exists "Users can create own leads" on public.leads;
    drop policy if exists "Users can update own leads" on public.leads;
    drop policy if exists "Users can delete own leads" on public.leads;
    create policy "Users can view own leads" on public.leads
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Users can create own leads" on public.leads
      for insert to authenticated with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Users can update own leads" on public.leads
      for update to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Users can delete own leads" on public.leads
      for delete to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;

  if to_regclass('public.saved_leads') is not null then
    drop policy if exists "Users can manage own saved_leads" on public.saved_leads;
    create policy "Users can manage own saved_leads" on public.saved_leads
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;

  if to_regclass('public.user_usage') is not null then
    drop policy if exists "Users can view own usage" on public.user_usage;
    drop policy if exists "Admins can manage usage" on public.user_usage;
    create policy "Users can view own usage" on public.user_usage
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Admins can manage usage" on public.user_usage
      for all to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;

  if to_regclass('public.user_subscriptions') is not null then
    drop policy if exists "Users can view their own subscription" on public.user_subscriptions;
    drop policy if exists "Users can insert their own subscription" on public.user_subscriptions;
    drop policy if exists "Admins can update subscriptions" on public.user_subscriptions;
    drop policy if exists "Admins can delete subscriptions" on public.user_subscriptions;
    create policy "Users can view their own subscription" on public.user_subscriptions
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Users can insert their own subscription" on public.user_subscriptions
      for insert to authenticated with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Admins can update subscriptions" on public.user_subscriptions
      for update to authenticated using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
    create policy "Admins can delete subscriptions" on public.user_subscriptions
      for delete to authenticated using (public.is_admin(auth.uid()));
  end if;

  if to_regclass('public.subscriptions') is not null then
    drop policy if exists "Users can view own subscriptions" on public.subscriptions;
    drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
    create policy "Users can view own subscriptions" on public.subscriptions
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Admins can manage subscriptions" on public.subscriptions
      for all to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;

  if to_regclass('public.user_addons') is not null then
    drop policy if exists "Users can read own addons" on public.user_addons;
    drop policy if exists "Admins can manage addons" on public.user_addons;
    create policy "Users can read own addons" on public.user_addons
      for select to authenticated using (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Admins can manage addons" on public.user_addons
      for all to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;

  if to_regclass('public.referrals') is not null then
    drop policy if exists "Users can view own referrals" on public.referrals;
    drop policy if exists "Admins can manage referrals" on public.referrals;
    create policy "Users can view own referrals" on public.referrals
      for select to authenticated
      using (
        public.is_admin(auth.uid())
        or auth.uid() = referrer_user_id
        or auth.uid() = referred_user_id
      );
    create policy "Admins can manage referrals" on public.referrals
      for all to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;

  if to_regclass('public.interacoes') is not null then
    drop policy if exists "Users can manage own interacoes" on public.interacoes;
    create policy "Users can manage own interacoes" on public.interacoes
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;

  if to_regclass('public.templates_mensagens') is not null then
    drop policy if exists "Users can manage own templates" on public.templates_mensagens;
    create policy "Users can manage own templates" on public.templates_mensagens
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;

  if to_regclass('public.campanhas') is not null then
    drop policy if exists "Users can manage own campanhas" on public.campanhas;
    create policy "Users can manage own campanhas" on public.campanhas
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;

  if to_regclass('public.campaigns') is not null then
    drop policy if exists "Users can manage own campaigns" on public.campaigns;
    drop policy if exists "Service role can manage campaigns" on public.campaigns;
    create policy "Users can manage own campaigns" on public.campaigns
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Service role can manage campaigns" on public.campaigns
      for all to service_role
      using (true)
      with check (true);
  end if;

  if to_regclass('public.reports') is not null then
    drop policy if exists "Users can manage own reports" on public.reports;
    drop policy if exists "Service role can manage reports" on public.reports;
    create policy "Users can manage own reports" on public.reports
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
    create policy "Service role can manage reports" on public.reports
      for all to service_role
      using (true)
      with check (true);
  end if;

  if to_regclass('public.leads_campanhas') is not null then
    drop policy if exists "Users can view own leads_campanhas" on public.leads_campanhas;
    drop policy if exists "Users can insert own leads_campanhas" on public.leads_campanhas;
    drop policy if exists "Users can update own leads_campanhas" on public.leads_campanhas;
    drop policy if exists "Users can delete own leads_campanhas" on public.leads_campanhas;
    create policy "Users can view own leads_campanhas" on public.leads_campanhas
      for select to authenticated
      using (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.leads l
          where l.id = leads_campanhas.lead_id
            and l.user_id = auth.uid()
        )
      );
    create policy "Users can insert own leads_campanhas" on public.leads_campanhas
      for insert to authenticated
      with check (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.leads l
          where l.id = leads_campanhas.lead_id
            and l.user_id = auth.uid()
        )
      );
    create policy "Users can update own leads_campanhas" on public.leads_campanhas
      for update to authenticated
      using (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.leads l
          where l.id = leads_campanhas.lead_id
            and l.user_id = auth.uid()
        )
      )
      with check (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.leads l
          where l.id = leads_campanhas.lead_id
            and l.user_id = auth.uid()
        )
      );
    create policy "Users can delete own leads_campanhas" on public.leads_campanhas
      for delete to authenticated
      using (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.leads l
          where l.id = leads_campanhas.lead_id
            and l.user_id = auth.uid()
        )
      );
  end if;

  if to_regclass('public.api_keys') is not null then
    drop policy if exists "Users can manage own api_keys" on public.api_keys;
    create policy "Users can manage own api_keys" on public.api_keys
      for all to authenticated
      using (public.is_admin(auth.uid()) or auth.uid() = user_id)
      with check (public.is_admin(auth.uid()) or auth.uid() = user_id);
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'email_campaigns',
    'email_queue',
    'email_unsubscribes',
    'email_ab_tests',
    'email_ab_results',
    'onboarding_emails_sent',
    'welcome_emails_sent',
    'email_job_locks',
    'email_events',
    'email_logs',
    'search_logs',
    'payment_events',
    'app_events',
    'security_events',
    'leads_access_log',
    'leads_audit_log',
    'email_logs_access_audit',
    'user_roles'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists "Admins can read %s" on public.%I', t, t);
      execute format(
        'create policy "Admins can read %s" on public.%I for select to authenticated using (public.is_admin(auth.uid()))',
        t,
        t
      );

      execute format('drop policy if exists "Admins can manage %s" on public.%I', t, t);
      execute format(
        'create policy "Admins can manage %s" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
        t,
        t
      );

      execute format('drop policy if exists "Service role can manage %s" on public.%I', t, t);
      execute format(
        'create policy "Service role can manage %s" on public.%I for all to service_role using (true) with check (true)',
        t,
        t
      );
    end if;
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'plans',
    'pricing',
    'public_config',
    'app_config',
    'lead_pricing_tiers',
    'templates_globais'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists "Public can read %s" on public.%I', t, t);
      execute format(
        'create policy "Public can read %s" on public.%I for select to anon, authenticated using (true)',
        t,
        t
      );

      execute format('drop policy if exists "Admins can manage public %s" on public.%I', t, t);
      execute format(
        'create policy "Admins can manage public %s" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
        t,
        t
      );

      execute format('drop policy if exists "Service role can manage public %s" on public.%I', t, t);
      execute format(
        'create policy "Service role can manage public %s" on public.%I for all to service_role using (true) with check (true)',
        t,
        t
      );
    end if;
  end loop;
end;
$$;

-- Post-check: this should return zero rows for the known app tables above.
select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;
