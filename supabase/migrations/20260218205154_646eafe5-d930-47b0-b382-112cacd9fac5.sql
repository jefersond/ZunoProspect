
-- =============================================
-- FIX: Change user-access policies from RESTRICTIVE to PERMISSIVE
-- The issue: ALL policies are RESTRICTIVE, so nobody gets access
-- PostgreSQL requires at least one PERMISSIVE policy to grant access
-- =============================================

-- ==================== PROFILES ====================
-- Drop existing user policies (RESTRICTIVE) and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
-- Drop anon policies and recreate scoped TO anon
DROP POLICY IF EXISTS "Block anon select on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anon insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anon update on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anon delete on profiles" ON public.profiles;

-- Recreate anon-blocking as RESTRICTIVE TO anon
CREATE POLICY "Block anon select on profiles" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon insert on profiles" ON public.profiles FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon update on profiles" ON public.profiles FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon delete on profiles" ON public.profiles FOR DELETE TO anon USING (false);

-- Recreate user policies as PERMISSIVE TO authenticated
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- ==================== LEADS ====================
DROP POLICY IF EXISTS "Usuários podem ver seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon select on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon insert on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon update on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon delete on leads" ON public.leads;

CREATE POLICY "Block anon select on leads" ON public.leads FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon insert on leads" ON public.leads FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon update on leads" ON public.leads FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon delete on leads" ON public.leads FOR DELETE TO anon USING (false);

CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== USER_SUBSCRIPTIONS ====================
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.user_subscriptions;

CREATE POLICY "Users can view their own subscription" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscription" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update subscriptions" ON public.user_subscriptions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- ==================== INTERACOES ====================
DROP POLICY IF EXISTS "Usuários podem ver suas próprias interações" ON public.interacoes;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias interações" ON public.interacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias interações" ON public.interacoes;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias interações" ON public.interacoes;

CREATE POLICY "Users can view own interacoes" ON public.interacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own interacoes" ON public.interacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interacoes" ON public.interacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interacoes" ON public.interacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== TEMPLATES_MENSAGENS ====================
DROP POLICY IF EXISTS "Usuários podem ver seus próprios templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios templates" ON public.templates_mensagens;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios templates" ON public.templates_mensagens;

CREATE POLICY "Users can view own templates" ON public.templates_mensagens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.templates_mensagens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.templates_mensagens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.templates_mensagens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== CAMPANHAS ====================
DROP POLICY IF EXISTS "Usuários podem ver suas próprias campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias campanhas" ON public.campanhas;

CREATE POLICY "Users can view own campanhas" ON public.campanhas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campanhas" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campanhas" ON public.campanhas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campanhas" ON public.campanhas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== LEADS_CAMPANHAS ====================
DROP POLICY IF EXISTS "Usuários podem ver seus próprios leads em campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Usuários podem adicionar seus próprios leads em campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios leads em campanhas" ON public.leads_campanhas;
DROP POLICY IF EXISTS "Usuários podem remover seus próprios leads de campanhas" ON public.leads_campanhas;

CREATE POLICY "Users can view own leads_campanhas" ON public.leads_campanhas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM leads l JOIN campanhas c ON c.id = leads_campanhas.campanha_id WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid() AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert own leads_campanhas" ON public.leads_campanhas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM leads l JOIN campanhas c ON c.id = leads_campanhas.campanha_id WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid() AND c.user_id = auth.uid()));

CREATE POLICY "Users can update own leads_campanhas" ON public.leads_campanhas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM leads l JOIN campanhas c ON c.id = leads_campanhas.campanha_id WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid() AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete own leads_campanhas" ON public.leads_campanhas FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM leads l JOIN campanhas c ON c.id = leads_campanhas.campanha_id WHERE l.id = leads_campanhas.lead_id AND l.user_id = auth.uid() AND c.user_id = auth.uid()));

-- ==================== API_KEYS ====================
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

CREATE POLICY "Users can view own api_keys" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api_keys" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==================== LEAD_PRICING_TIERS ====================
DROP POLICY IF EXISTS "Preços podem ser lidos por todos" ON public.lead_pricing_tiers;
CREATE POLICY "Anyone can read active pricing" ON public.lead_pricing_tiers FOR SELECT TO anon, authenticated USING (active = true);

-- ==================== TEMPLATES_GLOBAIS ====================
DROP POLICY IF EXISTS "Usuários autenticados podem ver templates globais" ON public.templates_globais;
DROP POLICY IF EXISTS "Admins podem gerenciar templates globais" ON public.templates_globais;

CREATE POLICY "Authenticated can view active templates" ON public.templates_globais FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "Admins can manage templates globais" ON public.templates_globais FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ==================== ADMIN-ONLY TABLES (fix to PERMISSIVE) ====================
-- email_campaigns
DROP POLICY IF EXISTS "Admins can view campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Admins can update campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.email_campaigns;

CREATE POLICY "Admins can view campaigns" ON public.email_campaigns FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert campaigns" ON public.email_campaigns FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update campaigns" ON public.email_campaigns FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete campaigns" ON public.email_campaigns FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users and admins can view roles" ON public.user_roles FOR SELECT TO authenticated USING (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- email_ab_tests
DROP POLICY IF EXISTS "Admins can manage AB tests" ON public.email_ab_tests;
CREATE POLICY "Admins can manage AB tests" ON public.email_ab_tests FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- email_ab_results
DROP POLICY IF EXISTS "Admins can view AB results" ON public.email_ab_results;
DROP POLICY IF EXISTS "Admins can insert AB results" ON public.email_ab_results;
DROP POLICY IF EXISTS "Admins can update AB results" ON public.email_ab_results;

CREATE POLICY "Admins can view AB results" ON public.email_ab_results FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert AB results" ON public.email_ab_results FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update AB results" ON public.email_ab_results FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- leads_access_log
DROP POLICY IF EXISTS "Admins can view access logs" ON public.leads_access_log;
CREATE POLICY "Admins can view access logs" ON public.leads_access_log FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- leads_audit_log
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.leads_audit_log;
CREATE POLICY "Admins can view audit logs" ON public.leads_audit_log FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- welcome_emails_sent
DROP POLICY IF EXISTS "Admins can view welcome emails" ON public.welcome_emails_sent;
CREATE POLICY "Admins can view welcome emails" ON public.welcome_emails_sent FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- onboarding_emails_sent
DROP POLICY IF EXISTS "Admins can view onboarding emails" ON public.onboarding_emails_sent;
CREATE POLICY "Admins can view onboarding emails" ON public.onboarding_emails_sent FOR SELECT TO authenticated USING (is_admin(auth.uid()));
