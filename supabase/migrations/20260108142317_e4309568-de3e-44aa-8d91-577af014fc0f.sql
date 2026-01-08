-- =====================================================
-- FIX: Corrigir políticas RLS permissivas em email_ab_results
-- =====================================================

-- Remover políticas permissivas antigas
DROP POLICY IF EXISTS "Service role can insert AB results" ON public.email_ab_results;
DROP POLICY IF EXISTS "Service role can update AB results" ON public.email_ab_results;

-- Recriar políticas com verificação adequada (apenas admins podem gerenciar)
CREATE POLICY "Admins can insert AB results" 
ON public.email_ab_results
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update AB results" 
ON public.email_ab_results
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));