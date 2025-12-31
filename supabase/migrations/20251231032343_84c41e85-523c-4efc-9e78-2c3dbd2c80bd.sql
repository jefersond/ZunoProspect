-- Fix leads_campanhas DELETE policy to verify both lead AND campaign ownership
-- This prevents users from deleting lead-campaign associations involving other users' campaigns

DROP POLICY IF EXISTS "Usuários podem remover seus próprios leads de campanhas" ON public.leads_campanhas;

CREATE POLICY "Usuários podem remover seus próprios leads de campanhas"
  ON public.leads_campanhas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.leads l
      INNER JOIN public.campanhas c ON c.id = leads_campanhas.campanha_id
      WHERE l.id = leads_campanhas.lead_id 
        AND l.user_id = auth.uid()
        AND c.user_id = auth.uid()
    )
  );

-- Also fix the other leads_campanhas policies for consistency (SELECT, INSERT, UPDATE)

DROP POLICY IF EXISTS "Usuários podem ver seus próprios leads em campanhas" ON public.leads_campanhas;

CREATE POLICY "Usuários podem ver seus próprios leads em campanhas"
  ON public.leads_campanhas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.leads l
      INNER JOIN public.campanhas c ON c.id = leads_campanhas.campanha_id
      WHERE l.id = leads_campanhas.lead_id 
        AND l.user_id = auth.uid()
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários podem adicionar seus próprios leads em campanhas" ON public.leads_campanhas;

CREATE POLICY "Usuários podem adicionar seus próprios leads em campanhas"
  ON public.leads_campanhas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.leads l
      INNER JOIN public.campanhas c ON c.id = leads_campanhas.campanha_id
      WHERE l.id = lead_id 
        AND l.user_id = auth.uid()
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios leads em campanhas" ON public.leads_campanhas;

CREATE POLICY "Usuários podem atualizar seus próprios leads em campanhas"
  ON public.leads_campanhas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.leads l
      INNER JOIN public.campanhas c ON c.id = leads_campanhas.campanha_id
      WHERE l.id = leads_campanhas.lead_id 
        AND l.user_id = auth.uid()
        AND c.user_id = auth.uid()
    )
  );