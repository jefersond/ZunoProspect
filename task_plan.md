# Planejamento da Tarefa: Otimização de Onboarding, CTAs de IA e Upgrades (Zuno Prospect)

## Fases do Projeto

### Fase 1: Descoberta e Visão (V.L.A.E.G. Protocol)
- [x] Analisar a estrutura de código (`LeadsList.tsx`, `AdminRealtime.tsx`, `useUsage.ts`, `tracking.ts`).
- [x] Obter respostas para as 5 perguntas de Descoberta (enviadas na mensagem inicial).
- [x] Definir esquema de dados e regras comportamentais na Constituição `gemini.md`.

### Fase 2: Conectividade e Link (Verificações)
- [x] Garantir que o envio de logs de eventos para o Supabase edge function `track-event` está íntegro.
- [x] Verificar que a Edge Function `analisar-lead-ia` consome créditos somente em caso de sucesso da análise.

### Fase 3: Desenvolvimento Arquitetural (Implementação)

#### 1. Jornada Pós-Busca (Empurrar Primeira IA)
- [x] Ajustar `shouldShowFirstAiCta` em `LeadsList.tsx` com novas copies contextuais.
- [x] Implementar a exibição do card de onboarding acima da tabela de leads para usuários Free com `ai_used === 0` e `ai_available > 0`.
- [x] Implementar o disparo do evento `First_AI_CTA_Shown` no máximo uma vez por busca/sessão com todos os metadados solicitados.
- [x] Implementar o clique do botão com o evento `First_AI_CTA_Clicked` que inicia a análise do lead recomendado de forma imediata.

#### 2. CTA e Microcopy na Tabela de Leads
- [x] Alterar o texto do botão do lead de "Analisar com IA" para "Gerar abordagem com IA".
- [x] Se o usuário for Free e `ai_used === 0`, renderizar microcopy perto do botão: "Use 1 das suas 3 análises grátis." ou similar.
- [x] Implementar e disparar o evento `AI_Lead_CTA_Shown` limitando a apenas o primeiro lead visível para evitar poluição.

#### 3. Reforço de Valor Pós-Primeira Análise
- [x] Quando a análise IA terminar com sucesso e for a primeiríssima do usuário Free, exibir banner/card de reforço:
  - Título: "Agora você tem contexto para abordar."
  - Texto de incentivo.
  - CTAs: "Analisar outro lead" (principal) e "Ver planos" (secundário).
- [x] Disparar o evento `First_AI_Analysis_Completed` com os metadados correspondentes.

#### 4. Notificações de Limites (Perto do Limite & Limite Esgotado)
- [x] Implementar alerta discreto quando `ai_used === 2` e `ai_available === 1` para o Free, mostrando o CTA "Ver planos" e "Usar última análise", disparando `AI_Limit_Near_Shown`.
- [x] Implementar card/modal com comparação de planos rápida e destaque premium quando o limite expirar (`ai_used === 3`), disparando `AI_Limit_Reached_Shown`.
- [x] Mapear eventos de upgrade direcionados: `Upgrade_Click_Before_AI`, `Upgrade_Click_After_AI`, `Upgrade_Click_After_Limit` na tabela de leads e diálogos.

#### 5. Segmentos e Recuperação no Painel Admin
- [x] Atualizar `matchesSegment` in `AdminRealtime.tsx` adicionando todos os novos segmentos e critérios de abandono.
- [x] Garantir visualização premium do segmento `checkout_abandoned` com detalhes do checkout acessíveis de forma clara.

### Fase 4: Estilo (Polimento visual e UX)
- [x] Aplicar design e gradientes modernos (glassmorphism/emerald harmonioso) nas mensagens e cards adicionados na tabela de leads.
- [x] Garantir micro-animações de carregamento e transição nos alertas de limite e onboarding.

### Fase 5: Gatilho (Testes de Homologação)
- [x] Criar e executar roteiro de testes (Cenários 1 a 6).
- [x] Validar integridade dos testes usando o parâmetro `?internal=true`.
- [x] Executar `npm run build` localmente para garantir estabilidade da transpilação TS.
