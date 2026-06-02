# Planejamento de Tarefas — Estabilização de IA & Atribuição de Origem

Este plano estabelece a checklist operacional e memória de estabilização para corrigir falhas críticas de IA, blindar créditos, prevenir cliques concorrentes e resolver problemas de atribuição de tráfego multitoque vazios.

---

## 🏗️ Fases do Projeto (Protocolo V.L.A.E.G.)

### 🟢 Fase 1: Visão e Lógica (Descoberta & Planejamento)
- [x] Analisar o comportamento da Edge Function `analisar-lead-ia` e o fluxo de IA em `LeadsList.tsx`.
- [x] Analisar o mapeamento de criativos em `creativeMap.ts` e visualização de atribuição em `AdminRealtime.tsx`.
- [x] Criar o plano de implementação em `implementation_plan.md` no diretório de artefatos.
- [x] Atualizar a Constituição do Projeto em `gemini.md`.
- [ ] Obter as respostas do usuário para as 5 Perguntas de Descoberta e aprovação do Blueprint.

### ⚡ Fase 2: Link e Conectividade
- [ ] Validar acessos a tabelas de logs e conectividade da Edge Function `/analisar-lead-ia`.
- [ ] Certificar CORS e respostas de erro estruturadas da Edge Function.

### ⚙️ Fase 3: Desenvolvimento Arquitetural (A.N.T.)

#### Camada 1: POPs Técnicos (`architecture/`)
- [ ] Criar POP de estabilização do fluxo de IA e prevenção de cliques duplicados na pasta `architecture/`.

#### Camada 2: Navegação e Componentes
- [ ] **LeadsList.tsx:** Implementar controle concorrente via `reanalyzingLeads` (ou `analyzingLeadIds`) impedindo cliques redundantes adicionais e tratando erros com mensagens amigáveis contextualizadas.
- [ ] **creativeMap.ts:** Adicionar o ID de criativo numérico `120248028635250725` no mapeamento de criativos.
- [ ] **AdminRealtime.tsx:**
  - Atualizar tipos de `AdminUserSummary` para atribuição.
  - Implementar inferência de First/Last Touch a partir de `selectedJourney` se estiverem vazios no profile.
  - Adicionar o Alerta Crítico vermelho de tráfego pago com IA quebrando no topo do modal de Jornada.
  - Adicionar badge vermelho na listagem principal de atividade ao vivo.
  - Ajustar a função `classifyAiFailure` para contemplar as 9 categorias exatas.
  - Exibir os 21 campos requeridos na auditoria de falhas de IA.

#### Camada 3: Ferramentas / Edge Functions
- [ ] **analisar-lead-ia (index.ts):** Ajustar o catch para retornar JSON de erro estruturado completo e garantir CORS em OPTIONS e falhas.

---

## 🛠️ Checklist de Testes Obrigatórios

- [ ] **Teste 1 (IA com sucesso):** Clicar em "Gerar abordagem com IA", confirmar loader, desabilitação, 1 request, sucesso gera abordagem e consome 1 crédito.
- [ ] **Teste 2 (IA com falha):** Simular falha na API, confirmar erro amigável, crédito mantido intacto, botão liberado para tentar novamente.
- [ ] **Teste 3 (Duplo clique):** Testar cliques rápidos concorrentes, confirmar prevenção de chamadas adicionais e evento `AI_Analysis_Duplicate_Click_Prevented`.
- [ ] **Teste 4 (Alerta de prejuízo):** Validar exibição do Alerta Crítico vermelho com 3+ falhas e 0 sucessos no painel e na atividade ao vivo.
- [ ] **Teste 5 (Touch Inferido):** Confirmar exibição de UTMs e criativos inferidos de eventos para profiles vazios.
- [ ] **Teste de Compilação:** Executar `npm run build` na pasta `reach-gen` e atestar que compila sem erros.
