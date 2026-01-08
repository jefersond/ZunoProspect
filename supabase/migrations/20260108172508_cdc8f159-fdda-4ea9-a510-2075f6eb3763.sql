-- 1. Remover políticas RESTRICTIVE atuais
DROP POLICY IF EXISTS "Usuários podem ver seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios leads" ON public.leads;

-- 2. Recriar como PERMISSIVE para o role authenticated
CREATE POLICY "Usuários podem ver seus próprios leads" 
ON public.leads
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios leads" 
ON public.leads
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios leads" 
ON public.leads
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios leads" 
ON public.leads
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);