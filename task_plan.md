# Planejamento de Tarefas — Estabilização do Painel ADM

Este plano estabelece a checklist operacional e memória de estabilização para blindar completamente o Painel Administrativo da Zuno Propect contra telas pretas e travamentos.

---

## 🏗️ Fases do Projeto (Protocolo V.L.A.E.G.)

### 🟢 Fase 1: Visão e Lógica (Descoberta & Planejamento)
- [x] Rodar `npx tsc --noEmit` e `npm run build` para checagem estática inicial.
- [x] Diagnosticar componentes críticos do admin (`AdminRealtime`, `AdminAbandonedCheckouts`, `AdminEmail`, `AdminSystemHealth`).
- [x] Criar o plano de implementação em `implementation_plan.md` no diretório de artefatos.
- [x] Atualizar a Constituição do Projeto em `gemini.md` no workspace.
- [ ] Obter as respostas do usuário para as 5 Perguntas de Descoberta e aprovação do Blueprint.

### ⚡ Fase 2: Link e Conectividade
- [ ] Validar acessos a tabelas de logs e conectividade de Edge Functions no painel `/admin/system-health`.
- [ ] Certificar CORS e respostas de erro estruturadas nas Edge Functions.

### ⚙️ Fase 3: Desenvolvimento Arquitetural (A.N.T.)

#### Camada 1: POPs Técnicos (`architecture/`)
- [ ] Criar ou revisar POPs de estabilização na pasta `architecture/` se regras de negócio mudarem.

#### Camada 2: Navegação e Componentes
- [ ] **AdminErrorBoundary.tsx:** [NEW] Criar componente de ErrorBoundary global e envolvê-lo no `App.tsx` para todas as páginas admin.
- [ ] **AdminStates.tsx:** [NEW] Criar componentes padrão `AdminLoadingState`, `AdminErrorState`, `AdminEmptyState`, `AdminSectionCard`, `AdminRetryButton`.
- [ ] **AdminSystemHealth.tsx:** Corrigir import de `Loader2` e blindar as checagens síncronas.
- [ ] **AdminRealtime.tsx:** Integrar try/catch/finally, blindar leitura de metadados nulos e adicionar bypass de admin.
- [ ] **AdminAbandonedCheckouts.tsx:** Blindar cálculos de prioridades e comportamento do funil de faturamento.
- [ ] **AdminEmail.tsx:** Blindar loops de loading nas requisições da Edge Function de disparo de campanhas.
- [ ] **UsersDashboard.tsx:** Blindar carregamento da Edge Function de usuários e detalhes de referrals.

---

## 🛠️ Checklist de Testes Obrigatórios

- [ ] **Teste de Compilação:** Executar `npm run build` localmente e atestar que compila sem erros.
- [ ] **Bypass de Admin:** Fazer login com o e-mail de admin principal e confirmar acesso imediato.
- [ ] **Teste de Resiliência (ErrorBoundary):** Provocar quebra síncrona em uma aba e atestar que a mensagem de erro amigável aparece sem travar o painel.
- [ ] **Tolerância a Dados Ausentes:** Mapear metadados nulos e garantir renderização perfeita com fallbacks ("não informado").
