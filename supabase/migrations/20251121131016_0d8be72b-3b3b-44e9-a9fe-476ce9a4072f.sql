-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  empresa TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seu próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar tabela de interações com leads
CREATE TABLE IF NOT EXISTS public.interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email', 'telefone', 'reuniao', 'nota')),
  conteudo TEXT NOT NULL,
  data_interacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela interacoes
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;

-- Policies para interacoes
CREATE POLICY "Usuários podem ver suas próprias interações"
  ON public.interacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias interações"
  ON public.interacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias interações"
  ON public.interacoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias interações"
  ON public.interacoes FOR DELETE
  USING (auth.uid() = user_id);

-- Criar tabela de templates de mensagens
CREATE TABLE IF NOT EXISTS public.templates_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email')),
  assunto TEXT,
  conteudo TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela templates_mensagens
ALTER TABLE public.templates_mensagens ENABLE ROW LEVEL SECURITY;

-- Policies para templates_mensagens
CREATE POLICY "Usuários podem ver seus próprios templates"
  ON public.templates_mensagens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios templates"
  ON public.templates_mensagens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios templates"
  ON public.templates_mensagens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios templates"
  ON public.templates_mensagens FOR DELETE
  USING (auth.uid() = user_id);

-- Criar tabela de campanhas de prospecção
CREATE TABLE IF NOT EXISTS public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'finalizada')),
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_fim TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela campanhas
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- Policies para campanhas
CREATE POLICY "Usuários podem ver suas próprias campanhas"
  ON public.campanhas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias campanhas"
  ON public.campanhas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias campanhas"
  ON public.campanhas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias campanhas"
  ON public.campanhas FOR DELETE
  USING (auth.uid() = user_id);

-- Criar tabela de relacionamento leads-campanhas
CREATE TABLE IF NOT EXISTS public.leads_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, campanha_id)
);

-- Habilitar RLS na tabela leads_campanhas
ALTER TABLE public.leads_campanhas ENABLE ROW LEVEL SECURITY;

-- Policies para leads_campanhas (baseado no user_id do lead)
CREATE POLICY "Usuários podem ver seus próprios leads em campanhas"
  ON public.leads_campanhas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = leads_campanhas.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem adicionar seus próprios leads em campanhas"
  ON public.leads_campanhas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = leads_campanhas.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar seus próprios leads em campanhas"
  ON public.leads_campanhas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = leads_campanhas.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem remover seus próprios leads de campanhas"
  ON public.leads_campanhas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = leads_campanhas.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em templates_mensagens
CREATE TRIGGER update_templates_mensagens_updated_at
  BEFORE UPDATE ON public.templates_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em campanhas
CREATE TRIGGER update_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_interacoes_lead_id ON public.interacoes(lead_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_user_id ON public.interacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_data ON public.interacoes(data_interacao DESC);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates_mensagens(user_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_user_id ON public.campanhas(user_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON public.campanhas(status);
CREATE INDEX IF NOT EXISTS idx_leads_campanhas_lead ON public.leads_campanhas(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_campanhas_campanha ON public.leads_campanhas(campanha_id);