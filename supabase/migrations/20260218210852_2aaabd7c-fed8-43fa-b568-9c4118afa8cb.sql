
-- =============================================
-- RESTRICT ALL ACCESS TO ADMIN ONLY
-- =============================================

-- PROFILES: Only admin can access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Admin can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- LEADS: Only admin
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;

CREATE POLICY "Admin can view leads" ON public.leads FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update leads" ON public.leads FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete leads" ON public.leads FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- USER_SUBSCRIPTIONS: Only admin + own view for profile trigger
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;

CREATE POLICY "Admin or own subscription view" ON public.user_subscriptions FOR SELECT TO authenticated USING (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admin or own subscription insert" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR auth.uid() = user_id);

-- INTERACOES: Only admin
DROP POLICY IF EXISTS "Users can view own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can create own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can update own interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Users can delete own interacoes" ON public.interacoes;

CREATE POLICY "Admin can view interacoes" ON public.interacoes FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create interacoes" ON public.interacoes FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update interacoes" ON public.interacoes FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete interacoes" ON public.interacoes FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- TEMPLATES_MENSAGENS: Only admin
DROP POLICY IF EXISTS "Users can view own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can create own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can update own templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates_mensagens;

CREATE POLICY "Admin can view templates" ON public.templates_mensagens FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create templates" ON public.templates_mensagens FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update templates" ON public.templates_mensagens FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete templates" ON public.templates_mensagens FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- CAMPANHAS: Only admin
DROP POLICY IF EXISTS "Users can view own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can create own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can update own campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Users can delete own campanhas" ON public.campanhas;

CREATE POLICY "Admin can view campanhas" ON public.campanhas FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create campanhas" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update campanhas" ON public.campanhas FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete campanhas" ON public.campanhas FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- LEADS_CAMPANHAS: Only admin
DROP POLICY IF EXISTS "Users can view own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can insert own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can update own leads_campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Users can delete own leads_campanhas" ON public.leads_campanhas;

CREATE POLICY "Admin can view leads_campanhas" ON public.leads_campanhas FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create leads_campanhas" ON public.leads_campanhas FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update leads_campanhas" ON public.leads_campanhas FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete leads_campanhas" ON public.leads_campanhas FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- API_KEYS: Only admin
DROP POLICY IF EXISTS "Users can view own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys" ON public.api_keys;

CREATE POLICY "Admin can view api_keys" ON public.api_keys FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can create api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete api_keys" ON public.api_keys FOR DELETE TO authenticated USING (is_admin(auth.uid()));
