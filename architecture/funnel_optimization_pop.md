# POP Técnico: Otimização de Funil, Ativação e Rastreamento Determinístico

## 1. Lógica Determinística de Desconto de Crédito IA
- **Regra de Ouro:** Limites e saldo de análise IA são decrementados apenas quando o processamento da Edge Function `analisar-lead-ia` obtiver retorno de sucesso HTTP 200/201.
- **Prevenção de Fugas de Créditos:** Se ocorrerem falhas do Gemini, limite excedido de Edge Function ou indisponibilidade, o usuário não pode sofrer redução de créditos.
- **Interface:** O hook `useUsage` gerencia a interface com a RPC do Supabase, que atualiza a contagem. O frontend reflete o novo consumo re-executando `refetchUsage()` logo após o sucesso da análise.

## 2. Invariante da UX de Upgrade
- **Antes do AHA:** Para novos usuários Free, todos os caminhos devem incentivar a execução da primeira análise com IA. A oferta de upgrade deve ser sutil e contextual (apenas no menu ou botão manual).
- **Momento AHA:** Ocorre no primeiro sucesso da geração de abordagem (`First_AI_Analysis_Completed`).
- **Pós-AHA (Gargalo e Esgotamento):**
  - Com 2 análises usadas (1 restante) e 1 análise usada (2 restantes): Banners leves avisam sobre o consumo.
  - Com 3 análises usadas (0 restantes): Card forte de upgrade com plano Starter e Pro assume o topo dos leads borrados para forçar a monetização.

## 3. Classificação e Filtros do Tracking Interno
- **Eventos de Teste/Internos:** Marcados como `is_internal_event = true` e `event_source_type = 'internal_test'`. Eles são identificados por:
  - Parâmetro URL `?internal=true` (salvo na sessão).
  - E-mails de administradores definidos (como `jeferson.zanotell@gmail.com`).
  - Domínios de desenvolvimento (`localhost`, `127.0.0.1`, `*.preview.*`).
- **Payload Padrão:** Todos os eventos de prospecção, IA, e upgrade devem ter `user_id`, `anonymous_id`, `session_id`, `path`, `page_url`, UTMs, `event_source_type`, `is_internal_event`, e metadados contextuais específicos em formato JSON.

## 4. Fórmulas de Segmentação (AdminRealtime)
Cada linha do usuário é mapeada no frontend para verificar a qual segmento pertence com base em seu histórico cronológico de eventos:
- **`cadastro_sem_busca`**: `!hasSearch`
- **`searched_no_ai`**: `hasSearch && !hasAiAnalysis`
- **`first_ai_cta_seen_no_click`**: `hasEvent('First_AI_CTA_Shown') && !hasEvent('First_AI_CTA_Clicked')`
- **`ai_limit_reached_no_upgrade`**: `isFree && aiUsed >= 3 && !hasPurchase`
- **`upgrade_no_checkout`**: `hasEvent('Upgrade_Click') && !hasCheckout`
- **`checkout_abandoned`**: `hasCheckout && !hasPurchase && (tempoDesdeCheckout >= janelaHoras)`
- **`hot_free_users`**: `isFree && totalSearches >= 2 && totalAiAnalyses >= 1 && !hasPurchase`
- **`high_intent_no_purchase`**: `totalSearches >= 2 && totalAiAnalyses >= 1 && totalUpgradeClicks >= 1 && !hasPurchase`

## 5. Diagnóstico de Funil por Usuário (Resumo Executivo)
O diagnóstico rápido do funil de onboarding segue a prioridade determinística decrescente:
1. `is_internal_event` = `"Jornada interna/teste. Não considerar como campanha real."`
2. `hasPurchase` = `"Conversão concluída."`
3. `checkout_abandoned` = `"Checkout abandonado."`
4. `upgrade_no_checkout` = `"Clicou em upgrade, mas não iniciou checkout."`
5. `ai_limit_reached_no_upgrade` = `"Usou todas as análises grátis, mas não clicou em upgrade."`
6. `first_ai_cta_seen_no_click` = `"Viu o CTA de IA, mas não clicou para gerar abordagem."`
7. `searched_no_ai` = `"Buscou leads, mas ainda não usou IA."`
8. `cadastro_sem_busca` = `"Criou conta, mas não fez primeira busca."`
