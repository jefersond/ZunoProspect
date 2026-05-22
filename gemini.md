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

---

## Invariantes Arquiteturais (Architectural Invariants)

- **Camada de Eventos:** Todo tracking deve passar pela função `trackEvent` centralizada em `src/lib/tracking.ts`.
- **Roteamento Determinístico de Segmentos:** A página de administração do painel realiza a computação dos segmentos no frontend a partir dos logs de eventos. A lógica deve ser exata e refletir as regras de negócio declaradas na aba admin sem quebrar views realtime.
