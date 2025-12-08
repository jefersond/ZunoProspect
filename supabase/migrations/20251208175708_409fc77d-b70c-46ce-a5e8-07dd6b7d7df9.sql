-- ========================================================
-- LEADS TABLE SECURITY HARDENING
-- Objetivo: Bloquear anon completamente e reforçar RLS
-- ========================================================

-- 1. Criar policies que bloqueiam ANON completamente
-- Estas policies têm prioridade e usam USING (false) para negar acesso

-- DROP existing anon policies if they exist (won't error if they don't)
DROP POLICY IF EXISTS "Block anon select on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon insert on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon update on leads" ON public.leads;
DROP POLICY IF EXISTS "Block anon delete on leads" ON public.leads;

-- Create explicit DENY policies for anonymous users
CREATE POLICY "Block anon select on leads" 
ON public.leads 
FOR SELECT 
TO anon
USING (false);

CREATE POLICY "Block anon insert on leads" 
ON public.leads 
FOR INSERT 
TO anon
WITH CHECK (false);

CREATE POLICY "Block anon update on leads" 
ON public.leads 
FOR UPDATE 
TO anon
USING (false);

CREATE POLICY "Block anon delete on leads" 
ON public.leads 
FOR DELETE 
TO anon
USING (false);

-- 2. Verificar que as policies existentes para authenticated estão corretas
-- (Não modificar - já usam auth.uid() = user_id corretamente)

-- 3. Adicionar comentário na tabela para documentação
COMMENT ON TABLE public.leads IS 'Tabela de leads com dados sensíveis criptografados. 
SEGURANÇA: 
- RLS ativado
- anon: BLOQUEADO completamente
- authenticated: apenas próprios leads (user_id = auth.uid())
- Dados sensíveis em colunas _encrypted (descriptografia via RPC server-side)
- Acesso preferencial via edge functions (leads-read, leads-manage)';