-- Tabela para armazenar os testes A/B de emails
CREATE TABLE public.email_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'A',
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email_type, variant)
);

-- Tabela para registrar resultados dos testes
CREATE TABLE public.email_ab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.email_ab_tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  variant_sent TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_email_ab_tests_active ON public.email_ab_tests(email_type, is_active);
CREATE INDEX idx_email_ab_results_test ON public.email_ab_results(test_id);
CREATE INDEX idx_email_ab_results_user ON public.email_ab_results(user_id);

-- Enable RLS
ALTER TABLE public.email_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_ab_results ENABLE ROW LEVEL SECURITY;

-- Políticas para admins
CREATE POLICY "Admins can manage AB tests" ON public.email_ab_tests
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view AB results" ON public.email_ab_results
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Service role can insert AB results" ON public.email_ab_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update AB results" ON public.email_ab_results
  FOR UPDATE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_email_ab_tests_updated_at
  BEFORE UPDATE ON public.email_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();