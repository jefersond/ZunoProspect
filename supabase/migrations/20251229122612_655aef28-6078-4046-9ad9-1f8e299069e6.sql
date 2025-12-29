-- Criar tabela de templates globais (públicos do sistema)
CREATE TABLE public.templates_globais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'whatsapp', 'email', 'instagram'
  categoria TEXT NOT NULL, -- 'primeiro_contato', 'follow_up', 'fechamento', 'consultivo'
  assunto TEXT, -- apenas para emails
  conteudo TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.templates_globais ENABLE ROW LEVEL SECURITY;

-- Política: todos usuários autenticados podem ler
CREATE POLICY "Usuários autenticados podem ver templates globais"
ON public.templates_globais
FOR SELECT
TO authenticated
USING (ativo = true);

-- Política: apenas admins podem gerenciar
CREATE POLICY "Admins podem gerenciar templates globais"
ON public.templates_globais
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_templates_globais_updated_at
BEFORE UPDATE ON public.templates_globais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates base de WhatsApp
INSERT INTO public.templates_globais (nome, tipo, categoria, conteudo, tags, ordem) VALUES
-- WhatsApp - Primeiro Contato
('Primeiro Contato Consultivo', 'whatsapp', 'primeiro_contato', 
'Olá! Tudo bem?

Sou {nome_remetente} e trabalho com {foco} aqui em {cidade}.

Encontrei a {empresa} e vi que vocês têm uma ótima reputação no Google ({rating}⭐). Parabéns pelo trabalho!

Notei algumas oportunidades que poderiam ajudar vocês a atrair ainda mais clientes pela internet.

Posso te mostrar em uma ligação rápida de 10 minutos?', 
ARRAY['consultivo', 'profissional'], 1),

('Primeiro Contato Direto', 'whatsapp', 'primeiro_contato',
'Oi! Tudo bem? 👋

Me chamo {nome_remetente} e ajudo empresas de {nicho} a conseguir mais clientes usando {foco}.

Vi que a {empresa} tem potencial para crescer ainda mais online.

Tenho algumas ideias específicas pro seu negócio. Podemos conversar 5 minutinhos?',
ARRAY['direto', 'casual'], 2),

('Abordagem com Dor', 'whatsapp', 'primeiro_contato',
'Oi! Percebi que a {empresa} ainda não tem presença forte nas redes ou anúncios pagos.

Isso pode estar fazendo vocês perderem clientes para concorrentes que investem em marketing digital.

Trabalho exatamente com isso e tenho um método que funciona muito bem para {nicho}.

Quer que eu te mostre como funciona?',
ARRAY['dor', 'urgência'], 3),

-- WhatsApp - Follow-up
('Follow-up Gentil', 'whatsapp', 'follow_up',
'Oi! Tudo bem?

Mandei uma mensagem há alguns dias sobre {foco} para a {empresa}.

Sei que a rotina é corrida, mas queria saber se conseguiu ver?

Tenho disponibilidade essa semana se quiser bater um papo rápido. 🙂',
ARRAY['gentil', 'lembrete'], 10),

('Follow-up com Valor', 'whatsapp', 'follow_up',
'Olá! Espero que esteja tudo bem por aí.

Desde que falei com você, ajudei uma empresa de {nicho} aqui de {cidade} a aumentar 40% os contatos pelo WhatsApp.

Pensei na {empresa} na hora. Quer saber como foi?',
ARRAY['case', 'valor'], 11),

-- WhatsApp - Fechamento
('Criar Urgência', 'whatsapp', 'fechamento',
'Oi! Lembra que conversamos sobre {foco}?

Estou com a agenda bem cheia esse mês, mas consegui reservar um horário pra gente finalizar.

Seria amanhã ou quinta que fica melhor pra você?',
ARRAY['urgência', 'fechamento'], 20),

-- Email - Primeiro Contato
('Email Frio Profissional', 'email', 'primeiro_contato',
'Olá,

Me chamo {nome_remetente} e sou especialista em {foco}.

Encontrei a {empresa} pesquisando empresas de {nicho} em {cidade} e fiquei impressionado com a reputação de vocês - {rating}⭐ no Google com {total_reviews} avaliações é excelente!

Analisando rapidamente a presença digital de vocês, identifiquei algumas oportunidades que poderiam trazer mais clientes:

• Otimização do perfil do Google para aparecer mais nas buscas
• Estratégias para converter visitantes do site em contatos
• Campanhas direcionadas para o público certo

Gostaria de apresentar essas ideias em uma conversa de 15 minutos, sem compromisso.

Qual horário funciona melhor para você essa semana?

Atenciosamente,
{nome_remetente}',
ARRAY['profissional', 'completo'], 1),

('Email com Case de Sucesso', 'email', 'primeiro_contato',
'Olá,

Recentemente ajudei uma empresa de {nicho} aqui em {cidade} a triplicar os contatos pelo site em apenas 2 meses.

O segredo? Uma estratégia bem direcionada de {foco}.

Acredito que a {empresa} tem potencial para resultados semelhantes ou até melhores.

Posso compartilhar como funcionou e adaptar para o seu negócio?

Abraço,
{nome_remetente}',
ARRAY['case', 'resultados'], 2),

-- Email - Follow-up  
('Email Follow-up', 'email', 'follow_up',
'Olá,

Enviei um email há alguns dias sobre oportunidades de {foco} para a {empresa}.

Sei que a rotina é corrida, então vou direto ao ponto:

• Análise gratuita da presença digital da {empresa}
• Sugestões práticas e personalizadas
• Sem compromisso

Tem 15 minutos essa semana para uma conversa rápida?

Abraço,
{nome_remetente}',
ARRAY['follow-up', 'objetivo'], 10),

-- Instagram - DM
('DM Instagram Casual', 'instagram', 'primeiro_contato',
'Oi! Vi o perfil de vocês e curti muito o trabalho da {empresa}! 🔥

Trabalho com {foco} e achei que podia ajudar vocês a crescer ainda mais aqui no Instagram.

Posso mandar umas ideias rápidas?',
ARRAY['casual', 'instagram'], 1),

('DM Após Interação', 'instagram', 'primeiro_contato',
'Oi! Obrigado por curtir nosso conteúdo! 😊

Vi que vocês são de {cidade} e trabalham com {nicho}. 

Temos algumas estratégias que funcionam muito bem pra esse segmento. Quer saber mais?',
ARRAY['interação', 'engajamento'], 2);

-- Inserir assuntos para emails
UPDATE public.templates_globais 
SET assunto = 'Oportunidade de crescimento para ' || '{empresa}'
WHERE tipo = 'email' AND categoria = 'primeiro_contato' AND nome = 'Email Frio Profissional';

UPDATE public.templates_globais 
SET assunto = 'Como uma empresa de {nicho} triplicou seus resultados'
WHERE tipo = 'email' AND nome = 'Email com Case de Sucesso';

UPDATE public.templates_globais 
SET assunto = 'Re: Oportunidade para {empresa}'
WHERE tipo = 'email' AND categoria = 'follow_up';