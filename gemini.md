# Constituição do Projeto - Zuno Prospect - Onboarding & IA Upgrades

## Esquemas de Dados (Data Schemas)

### Novos Eventos de Rastreamento (App Events)

Todos os eventos de rastreamento devem salvar os campos obrigatórios na tabela `app_events`:
- `user_id` (UUID | null)
- `user_email` (text | null, apenas interno/admin se já existir, sem vazar dados sensíveis)
- `session_id` (text)
- `anonymous_id` (text)
- `event_name` (text)
- `path` (text)
- `page_url` (text)
- `utm_source` (text | null)
- `utm_medium` (text | null)
- `utm_campaign` (text | null)
- `utm_content` (text | null)
- `creative_name` (text | null, normalizado via `creativeMap`)
- `event_source_type` (text, ex: 'paid', 'organic', 'direct', 'referral', 'internal_test', 'unknown')
- `is_internal_event` (boolean, padrão false)
- `metadata` (jsonb, dados contextuais específicos)

#### 1. First_AI_CTA_Shown (Onboarding Pós-Busca)
Disparado quando o card de primeira análise IA pós-busca for exibido acima dos leads.
**Payload (`metadata`):**
```json
{
  "source": "after_search",
  "location": "results_top_banner",
  "user_plan": "free" | "starter" | "pro" | "agency",
  "ai_used": number,
  "ai_available": number,
  "ai_limit": number,
  "leads_available": number,
  "leads_used": number,
  "leads_limit": number,
  "search_id": string | null,
  "leads_count": number
}
```

#### 2. First_AI_CTA_Clicked
Disparado quando o usuário clica no CTA de primeira análise IA pós-busca.
**Payload (`metadata`):**
```json
{
  "source": "after_search",
  "location": "results_top_banner",
  "lead_id": string | null,
  "lead_name": string | null,
  "user_plan": "free" | "starter" | "pro" | "agency",
  "ai_used": number,
  "ai_available": number,
  "ai_limit": number
}
```

#### 3. AI_Lead_CTA_Shown
Disparado quando o botão de IA é exibido para o primeiro lead da lista.
**Payload (`metadata`):**
```json
{
  "lead_id": string,
  "lead_name": string,
  "position": number,
  "user_plan": "free" | "starter" | "pro" | "agency",
  "ai_used": number,
  "ai_available": number,
  "has_done_first_ai_analysis": boolean
}
```

#### 4. Eventos de Lógica IA (AI_Analysis_Started, AI_Analysis_Completed, AI_Analysis_Failed)
Disparados nas etapas de execução do fluxo principal da IA.
**Payload (`metadata`):**
```json
{
  "lead_id": string,
  "lead_name": string,
  "user_plan": string,
  "ai_used_before": number,
  "ai_used_after": number,
  "ai_available_before": number,
  "ai_available_after": number,
  "source": string,
  "path": string
}
```

#### 5. First_AI_Analysis_Completed
Disparado somente quando a primeiríssima análise IA do usuário terminar com total sucesso.
**Payload (`metadata`):**
```json
{
  "lead_id": string,
  "lead_name": string,
  "user_plan": string,
  "ai_used": number,
  "ai_available": number,
  "ai_limit": number,
  "leads_used": number,
  "leads_limit": number
}
```

#### 6. AI_Limit_Near_Shown (Alerta 2/3 IA Usadas no Free)
Disparado quando o usuário visualiza o alerta discreto informando que resta apenas 1 análise grátis.
**Payload (`metadata`):**
```json
{
  "user_plan": "free",
  "ai_used": 2,
  "ai_limit": 3,
  "ai_available": 1
}
```

#### 7. AI_Limit_Reached_Shown (Modal/Card 3/3 IA Esgotadas)
Disparado quando o usuário atinge o limite do plano Free e vê o card/modal de upgrade.
**Payload (`metadata`):**
```json
{
  "user_plan": "free",
  "ai_used": 3,
  "ai_limit": 3,
  "ai_available": 0
}
```

#### 8. Upgrade_Click_Before_AI | Upgrade_Click_After_AI | Upgrade_Click_After_Limit
Disparados ao clicar em Upgrade sob diferentes condições do funil.
**Payload (`metadata`):**
```json
{
  "source": "ai_limit_reached" | "navbar" | "leads_list" | "after_search",
  "user_plan": string,
  "ai_used": number,
  "ai_limit": number,
  "leads_used": number,
  "leads_limit": number
}
```

---

## Regras Comportamentais (Behavioral Rules)

1. **UX Rule - Prioridade do AHA:** Se o usuário Free tiver IA disponível e nunca gerou análises, priorizar os CTAs consultivos de IA em vez de empurrar o upgrade agressivo. Upgrade agressivo deve esperar o momento AHA ou o esgotamento do limite.
2. **Determinismo de Créditos:** O saldo de análise com IA só pode ser descontado se a análise for concluída com absoluto sucesso. Erros não consomem limites de IA.
3. **Preservação de Integrações:** É expressamente proibido alterar a lógica de faturamento, preços, integrações Stripe ou webhooks existentes.
4. **Isolamento de Testes Internos:** Todos os eventos gerados com `?internal=true`, session/localStorage `zuno_internal_test` ou por e-mails internos definidos em `tracking.ts` devem ter `is_internal_event = true` e `event_source_type = 'internal_test'`.
5. **Persistência de Busca e Busca Incremental:** O formulário completo de busca (`FormData`) deve ser salvo no `localStorage` (`zuno_last_search_form_data`) após o envio de qualquer busca bem-sucedida. Uma busca incremental deve herdar e manter estes dados, e os leads correspondentes devem ser mesclados na tabela sem apagar leads não salvos (ao contrário da busca convencional, que realiza a limpeza prévia).

---

## Invariantes Arquiteturais (Architectural Invariants)

- **Camada de Eventos:** Todo tracking deve passar pela função `trackEvent` centralizada em `src/lib/tracking.ts`.
- **Roteamento Determinístico de Segmentos:** A página de administração do painel realiza a computação dos segmentos no frontend a partir dos logs de eventos. A lógica deve ser exata e refletir as regras de negócio declaradas na aba admin sem quebrar views realtime.

---

## Novos Esquemas de Dados de Automação de E-mail

### Tabela public.behavior_email_queue
Armazena a fila de e-mails comportamentais a serem enviados.
- `id` uuid PRIMARY KEY
- `user_id` uuid REFERENCES auth.users(id) ON DELETE SET NULL
- `email` text NOT NULL
- `automation_key` text NOT NULL (ex: 'signup_no_search_1h')
- `status` text NOT NULL DEFAULT 'pending' ('pending', 'sent', 'failed', 'skipped')
- `scheduled_for` timestamptz NOT NULL
- `sent_at` timestamptz NULL
- `failed_at` timestamptz NULL
- `skipped_at` timestamptz NULL
- `skip_reason` text NULL (ex: 'unsubscribed', 'already_completed', 'daily_limit_reached', 'purchased_user')
- `resend_message_id` text NULL
- `metadata` jsonb DEFAULT '{}'::jsonb
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

Constraint UNIQUE: `UNIQUE(email, automation_key)`

### Tabela public.behavior_email_logs
Registra o histórico e logs de todas as tentativas e status dos e-mails da fila.
- `id` uuid PRIMARY KEY
- `queue_id` uuid REFERENCES public.behavior_email_queue(id) ON DELETE SET NULL
- `user_id` uuid NULL
- `email` text NOT NULL
- `automation_key` text NOT NULL
- `status` text NOT NULL ('queued', 'sent', 'failed', 'skipped')
- `resend_message_id` text NULL
- `error_message` text NULL
- `metadata` jsonb DEFAULT '{}'::jsonb
- `created_at` timestamptz DEFAULT now()

---

## Regras Comportamentais de E-mail (Email Behavioral Rules)

1. **Evitar Spam e Sobrecarga:** Nunca enviar mais de 1 e-mail comportamental por dia para o mesmo usuário. Se houver novas automações pendentes marcadas para o mesmo dia, elas devem ser marcadas como `skipped` com `skip_reason = 'daily_limit_reached'`.
2. **Precedência de Compra (Safety):** Usuários que efetuaram compras (plano ativado pago no Stripe/Supabase) estão estritamente elegíveis apenas para o e-mail de transação de boas-vindas. Estão sumariamente excluídos de receber qualquer e-mail comportamental de checkout abandonado ou upgrade de IA. Nesses casos, o status deve ser `skipped` com `skip_reason = 'purchased_user'`.
3. **Validação Pré-envio (Double-Check):** O processador de automações de e-mail deve realizar uma verificação secundária das regras de negócio no instante exato do envio para garantir que o usuário não realizou a ação que gerou a automação no período entre o agendamento e o disparo real (ex: o usuário abandonou o checkout, agendou em 1h, mas comprou 30 minutos depois; o e-mail deve ser cancelado/skipped com `already_completed` ou `purchased_user`).
4. **Respeito Absoluto a Unsubscribe:** Antes de agendar ou de enviar qualquer e-mail da fila, checar a tabela `public.email_unsubscribes`. Se o e-mail do usuário constar nela ou se o fingerprint bater, marcar o status como `skipped` com `skip_reason = 'unsubscribed'`.
5. **Modo de Teste Controlado:** Se `BEHAVIOR_EMAIL_TEST_MODE=true` no ambiente, o processador só poderá enviar e-mails reais para a lista de e-mails autorizados em `BEHAVIOR_EMAIL_ALLOWED_TEST_RECIPIENTS` (ex: `jeferson.zanotell@gmail.com`). Qualquer outro destinatário real deve ser pulado com `skip_reason = 'test_mode_recipient_not_allowed'`. Em ambiente de desenvolvimento (`localhost`), e-mails reais não devem ser enviados a usuários de produção.
6. **Autenticidade Visual Zuno:** Todo e-mail disparado deve utilizar a identidade visual escura oficial (background escuro `#0b0f0e`, card `#111816`, detalhes em verde esmeralda `#10d98a` e botões premium), contendo obrigatoriamente versões HTML e PlainText, link de descadastro ativo e cabeçalho/rodapé institucionais da marca.

---

## Novos Esquemas de Dados de Auditoria de IA (Constituição)

### Evento: AI_Analysis_Failed / ai_analysis_failed (Enriquecido)
Registra falhas ocorridas na Edge Function ou no frontend durante a análise de leads por inteligência artificial.
**Payload (`metadata` / `eventData`):**
```json
{
  "lead_id": "string",
  "lead_name": "string | null",
  "source": "string",
  "path": "string",
  "error_message": "string",
  "error_code": "string | null",
  "error_type": "string | null",
  "ai_used_before": "number",
  "ai_used_after": "number",
  "ai_available_before": "number",
  "ai_available_after": "number",
  "deducted_credit": "boolean",
  "request_id": "string",
  "edge_function": "string",
  "provider": "string",
  "duration_ms": "number",
  "retry_count": "number",
  "had_success_after": "boolean | null",
  "success_after_seconds": "number | null"
}
```

### Evento: AI_Analysis_Duplicate_Click_Prevented
Registrado no frontend do usuário quando cliques adicionais concorrentes no botão de IA são prevenidos.
**Payload (`metadata`):**
```json
{
  "lead_id": "string",
  "lead_name": "string",
  "source": "string",
  "timestamp": "string"
}
```

---

## Regras Comportamentais de IA e Concorrência

1. **Prevenção Rígida de Concorrência:** O acionamento da inteligência artificial para um `lead_id` específico deve ser bloqueado síncronamente no clique do botão se uma requisição anterior já estiver ativa. O estado deve ser controlado individualmente por `lead_id` (`analyzingLeadIds`).
2. **Determinismo Absoluto do Saldo:** O débito de crédito (`deducted_credit: true`) só é válido após o evento `AI_Analysis_Completed`. Eventos de erro de IA **nunca** devem debitar saldo do usuário. Se `ai_used_after > ai_used_before` ou se `deducted_credit: true` for detectado em um evento de falha, disparar um alerta técnico crítico no painel do administrador.
3. **UX de Retentativa e Explicação:** Em erros técnicos de IA (exceto saldo esgotado), o toast ou card de erro no frontend deve esclarecer que o saldo não foi consumido e fornecer a opção amigável para tentar novamente.

---

## Novos Esquemas de Dados e Regras de Limites de IA

### Evento: AI_Analysis_Blocked_By_Limit
Registrado no frontend do usuário quando ele tenta gerar uma análise de IA mas não possui créditos/saldo grátis disponíveis no seu plano.
**Payload (`metadata`):**
```json
{
  "lead_id": "string",
  "lead_name": "string",
  "source": "string",
  "path": "string",
  "user_plan": "string",
  "ai_used": "number",
  "ai_limit": "number",
  "ai_available": "number",
  "leads_used": "number",
  "leads_limit": "number",
  "has_done_first_ai_analysis": "boolean",
  "reason": "ai_limit_reached",
  "blocked_before_ai_call": true
}
```

### Evento: AI_Limit_Reached_Shown (Atualizado)
Disparado estritamente apenas quando o card/modal/banner de limite esgotado é de fato exibido em tela. Deve ser controlado para disparar no máximo uma vez por sessão ou contexto de localização.
**Payload (`metadata`):**
```json
{
  "source": "string",
  "location": "string",
  "user_plan": "string",
  "ai_used": "number",
  "ai_limit": "number",
  "ai_available": "number",
  "reason": "ai_limit_reached"
}
```

### Evento: Upgrade_Click_After_Limit
Disparado quando o usuário clica no botão principal de CTA de Upgrade depois de ter atingido o seu limite de análises IA grátis.
**Payload (`metadata`):**
```json
{
  "source": "ai_limit_reached",
  "cta_text": "string",
  "user_plan": "string",
  "ai_used": "number",
  "ai_limit": "number",
  "ai_available": "number",
  "leads_used": "number",
  "leads_limit": "number",
  "plan_id": "string",
  "path": "string"
}
```

### Regras Comportamentais Estritas de IA Sem Saldo
1. **Bloqueio Preventivo Síncrono:** Se `ai_available <= 0`, o sistema no frontend deve interceptar o clique imediatamente, disparando `AI_Analysis_Blocked_By_Limit`, abrindo o diálogo de upgrade e parando o fluxo de forma limpa. Não deve disparar `AI_Analysis_Started` nem chamar a Edge Function ou registrar `AI_Analysis_Failed`.
2. **Debounce de Bloqueios:** Para cliques rápidos repetitivos sem saldo, o diálogo de planos abre normalmente, mas o evento de tracking de bloqueio é ignorado e debouncado síncronamente (limite de 1 evento a cada 5 segundos por lead) para evitar poluição dos logs de tráfego.
3. **Botão Interativo de Upgrade:** Quando sem saldo, os botões de análise IA nos leads não devem ser acinzentados ou desabilitados de clique, mas sim ter seu texto alterado para "Liberar mais análises" e atuar como gatilhos amigáveis do fluxo de upgrade comercial do SaaS.

---

## Nova Visão: Checkouts Abandonados no Painel Admin

### Esquema do Evento InitiateCheckout (Enriquecido)
Evento de rastreamento disparado na finalização segura do checkout (`app_events`).
**Payload (`metadata`):**
```json
{
  "plan_id": "string",
  "plan_name": "string",
  "value": "number",
  "currency": "BRL",
  "source": "string",
  "checkout_source": "string",
  "stripe_session_id": "string | null",
  "user_plan_before_checkout": "string",
  "current_leads_available": "number",
  "current_ai_available": "number",
  "leads_used": "number",
  "leads_limit": "number",
  "ai_used": "number",
  "ai_limit": "number",
  "has_done_first_search": "boolean",
  "has_done_first_ai_analysis": "boolean"
}
```

### Regras Comportamentais e Classificações (Checkouts Abandonados)
1. **Critério de Abandono (Janela de 1h):** Um usuário é elegível para a fila de abandonados se possuir registro de `InitiateCheckout` (ou `checkout_started`/`Checkout_Started`) e nenhum evento correspondente posterior de `Purchase` (ou `purchase_completed`). Se ocorrido há menos de 1 hora, define-se como `recent`. Se há mais de 1 hora, define-se como `abandoned`.
2. **Classificação de Status Síncrona:**
   - **converted:** `Purchase` registrado pós-checkout.
   - **checkout_failed:** `Checkout_Failed` registrado pós-checkout, sem compra.
   - **recent:** Menos de 1 hora do checkout, sem compra nem falha.
   - **abandoned:** Mais de 1 hora do checkout, sem compra nem falha.
3. **Priorização de Suporte:**
   - **CRÍTICA:** Abandonado com alta intenção (sucessos de IA >= 3, cliques de upgrade >= 3, sem compra).
   - **TÉCNICA:** Falhas recorrentes de IA antes do checkout (falhas de IA > 3 ou falhas de IA > sucessos) ou evento `Checkout_Failed` presente.
   - **ALTA:** Abandonado vindo de tráfego pago (paid) e que obteve AHA moment (IA sucesso >= 1 ou cliques de upgrade >= 1).
   - **NORMAL:** Outros casos de menor engajamento ou checkouts recentes.

---

## 4. Invariantes da Área Administrativa (ADM)

### Proteções de Acesso e Autenticação
1. **Bypass Síncrono de Admin Principal:** O e-mail `jeferson.zanotell@gmail.com` (e o email legacy `jefeson.zanotell@gmail.com`) recebe bypass imediato e síncrono no frontend nas checagens administrativas. Sob nenhuma circunstância de falha de conexão do Supabase ou latência de rede o acesso do admin principal deve ser bloqueado com tela preta ou loading infinito.
2. **Bypass de Faturamento para Admin:** O admin principal terá limites mockados em `999999` para leads, IA, leads bônus e saldo restante, com acesso permanente a todos os recursos premium do SaaS sem depender de assinaturas ou planos ativos no Stripe.

### Tratamento e Padronização de Estados das Abas
1. **Independência de Abas (Error Boundary):** As abas do admin devem operar de forma isolada através do `AdminErrorBoundary`. A falha catastrófica em runtime de uma aba (ex: colunas ausentes ou erro CORS de Edge Function) nunca deve derrubar o painel administrativo inteiro, exibindo em vez disso um card de erro amigável contextualizado.
2. **Ciclo de Vida do Loading (Try-Catch-Finally):** Qualquer requisição administrativa de dados no Supabase ou Edge Functions deve ser envelopada em um bloco `try/catch` síncrono, garantindo o desligamento do loader (`setLoading(false)`) no bloco `finally` e exibindo `AdminErrorState` com botão de retentativa em caso de falha.
3. **Resiliência a Campos Nulos:** Na listagem de tráfego, jornada e checkouts, qualquer leitura de metadados nulos ou ausentes deve ser normalizada síncronamente com fallbacks amigáveis (ex: `value || "não informado"`), impedindo quebras de render no React.
