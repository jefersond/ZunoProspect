# Descobertas e Restrições Técnicas - Automações de E-mail

- **Unsubscribe Existente:** A tabela `public.email_unsubscribes` já existe e mapeia descadastros usando `user_id` e `email_fingerprint` (hash SHA-256 do e-mail em minúsculas). A Edge Function `unsubscribe-email` gerencia isso salvando os dados e inserindo um evento na tabela `public.email_events` do tipo `unsubscribe`.
- **API do Resend no Supabase:** Configurações centralizadas nas variáveis de ambiente `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (Zuno Propect <contato@zunopropect.com.br>) e `RESEND_REPLY_TO_EMAIL` (contato@zunopropect.com.br). O disparo é feito enviando um HTTP POST para a API oficial do Resend (`https://api.resend.com/emails`).
- **Prevenção de Spam (Rate Limit Diário):** Para garantir uma excelente experiência ao usuário final, a Constituição (`gemini.md`) estabelece o limite estrito de **no máximo 1 e-mail comportamental por usuário por dia**. Qualquer nova automação disparada para o mesmo usuário no mesmo dia deve ser pulada com status `skipped` e `skip_reason = 'daily_limit_reached'`.
- **Safety de Faturamento / Assinaturas Ativas:** Usuários que compraram (`Purchase` / assinatura paga) não podem receber e-mails de checkout abandonado ou upgrade de IA, apenas e-mails transacionais (como boas-vindas). O processador deve pular essas automações com `skip_reason = 'purchased_user'`.
- **Double-Check Lógico Pré-Envio:** Como há intervalos de tempo entre o agendamento (1h ou 24h) e o envio real, o processador deve reavaliar os critérios de negócios no momento exato de enviar o e-mail da fila para garantir que a ação já não tenha sido realizada nesse meio tempo (ex: o usuário abandonou o checkout, mas finalizou a compra 15 minutos depois; nesse caso, o e-mail agendado de checkout abandonado deve ser cancelado com status `skipped` e `skip_reason = 'already_completed'`).
- **Modo de Teste Controlado:** Quando `BEHAVIOR_EMAIL_TEST_MODE = true` estiver ativado no ambiente do Supabase, o processador só enviará e-mails reais para a lista de e-mails autorizados em `BEHAVIOR_EMAIL_ALLOWED_TEST_RECIPIENTS` (ex: `jeferson.zanotell@gmail.com`). Qualquer outro destinatário será pulado com `skip_reason = 'test_mode_recipient_not_allowed'`. Isso isola e-mails em desenvolvimento de irem para clientes reais.


---

# Descobertas Técnicas - Auditoria Analítica de Falhas de IA

- **Consumo de Créditos em Falhas:** Confirmado por auditoria estrita do código que o saldo de IA (`increment_ai_usage`) é debitado **apenas após** a geração bem-sucedida do diagnóstico com o Gemini e salvamento no banco de dados. Falhas de API, timeouts ou cliques redundantes do usuário **não** decrementam o limite do usuário.
- **Risco de Múltiplos Cliques concorrentes:** Descobrimos que, devido à natureza assíncrona do React, múltiplos cliques rápidos consecutivos no botão "Gerar abordagem com IA" disparam requisições paralelas à Edge Function antes de o estado de loading (`reanalyzingLeads` ou `isReanalyzing`) terminar de atualizar no DOM. Isso gera múltiplos eventos redundantes de falha ou sucesso no histórico. Solucionaremos com bloqueio síncrono via `useRef<Set<string>>` no componente de leads.
- **Classificação de Erros no Painel:** O frontend do admin classificará de forma inteligente os erros em subcategorias (*Timeout*, *Sem saldo*, *Múltiplos cliques*, *Possível duplicação*, *Falha recuperada* e *Falha real*) inspecionando a string da mensagem de erro e a proximidade temporal dos eventos (< 5 segundos para cliques múltiplos, < 2 minutos para recuperação bem-sucedida).

---

# Descobertas Técnicas - Solução Emergencial de Faturamento & Reconciliação do Plano Pro no Admin

- **Mapeamento de Preços Dinâmicos do Stripe:** A Edge Function `create-stripe-checkout` gera os preços de forma dinâmica na Stripe Session (`price_data` contendo o `unit_amount`), o que faz com que a Stripe crie Price IDs dinâmicos de forma automática para cada checkout síncrono. Por conta disso, os Price IDs não são estáticos nem previsíveis de antemão. Para contornar e prover uma redundância de segurança absoluta, o resolvedor inteligente decodifica os valores cobrados em centavos: R$ 47 (4700 centavos) ou R$ 470 (47000 centavos) representam o plano **Starter**, R$ 97 (9700 centavos) ou R$ 970 (97000 centavos) representam o **Pro** e R$ 247 (24700 centavos) ou R$ 2470 (247000 centavos) representam o **Agency**.
- **Causa da Divergência de Plano no Admin (Caso Real):** O cliente que comprou Pro ontem e foi registrado erroneamente como "Agência" no painel Zuno se deu devido a uma inconsistência de migração do banco. A migração `20260525130000_activate_pro_users_and_admins.sql` ativou a role de admin do usuário `falecom@klsalescompany.com` (atualizado de `kiefferlinconts@gmail.com`) e o trigger `handle_new_user_subscription` inseriu automaticamente o plano `'agencia'` na tabela `user_subscriptions` (por constar na lista de emails de admin).
- Na migração seguinte `20260525150000_remove_admin_privileges.sql`, os privilégios administrativos foram removidos dele da tabela `user_roles` e seu buscas_saldo foi zerado no perfil, mas a migração **se esqueceu de atualizar a tabela `user_subscriptions` para voltar a conta dele para `'pro'`.** Como o painel lê o plano direto de `user_subscriptions`, a conta continuava listada incorretamente como plano Agência!
- **Registro de Vendas Órfãs em app_events:** O webhook original descartava logs do `logAppEvent` se o `userId` fosse nulo (quando o usuário não era correspondido pelo e-mail ou Stripe IDs). Refatoramos o webhook para registrar com robustez em `app_events` mesmo sem o `userId` (como falha ou órfão), permitindo auditar imediatamente no painel de administração e cruzar os dados de e-mail e pagamento sem perder rastreamento.
- **Idempotência analítica no painel Tempo Real:** O recebimento de eventos simultâneos de `checkout.session.completed` e `invoice.payment_succeeded` na Stripe para a mesma transação gerava logs duplicados de conversão no funil. Adicionamos a função `checkDuplicatePurchaseEvent` que verifica no banco se já existe um evento `"purchase_completed"` registrado para aquele `checkout_session_id` ou `subscription_id` nas últimas 24 horas antes de inserir um novo log na tabela `app_events`, blindando a precisão do funil de conversão contra eventos duplicados.

---

# Descobertas Técnicas - Atribuição de Origem Multitoque (First & Last Touch)

- **Armazenamento de 18 Campos na Tabela Profiles:** Para evitar joins complexos no banco de dados e garantir máxima performance nos painéis de administração em tempo real, optamos por salvar a atribuição de primeiro toque (`first_touch`) e último toque (`last_touch`) diretamente como 18 colunas planas no perfil do usuário (`public.profiles`) em vez de criar uma tabela separada. Isso facilita as buscas seguras por políticas RLS.
- **Proteção Antissubstituição Lógica (Idempotency):** Para evitar que acessos subsequentes diretos e internos corrompam as fontes de tráfego pago originais, aplicamos uma regra rigorosa no frontend (`src/lib/tracking.ts`) e no backend (`supabase/functions/track-event`):
  - O `first_touch` só pode ser gravado uma vez e **NUNCA** pode ser sobrescrito por um acesso direto (`direct`). Caso o primeiro acesso seja orgânico/referral e o usuário clique em um link pago posteriormente, o `first_touch` é promovido para a campanha paga (upgrading lógico de atribuição).
  - O `last_touch` registra a última UTM ou referenciador útil ativo e ignora cliques internos ou acessos diretos se o usuário já tiver uma fonte útil na sessão.
- **Enriquecimento Stripe Webhook:** O webhook da Stripe (`stripe-webhook/index.ts`) lê as colunas de atribuição diretamente de `public.profiles` usando o `user_id` e enriquece os metadados do evento analítico `"purchase_completed"` em `app_events`. Isso garante que o painel de Atividade ao Vivo mostre imediatamente de qual campanha/criativo o comprador se originou inicialmente, mesmo que ele tenha efetuado a compra meses depois via acesso direto sem UTM.
- **Diagnósticos de Marketing Inteligentes:** O painel admin de jornada calcula dinamicamente 5 categorias de diagnóstico:
  1. *Compra direta com possível influência anterior de campanha:* Comprador atual direto, mas com primeiro contato vindo de campanha paga.
  2. *Compra por campanha recente, mas primeira origem foi outra campanha:* Primeiro contato em uma campanha, mas conversão impulsionada por outra campanha mais recente.
  3. *Usuário entrou direto inicialmente e converteu após campanha:* Entrou orgânico/direto inicialmente e converteu via campanha paga.
  4. *Origem consistente:* Primeiro e último contatos idênticos.
  5. *Origem consistente com variações de canais:* Primeiro e último contatos ativos com variações secundárias.

