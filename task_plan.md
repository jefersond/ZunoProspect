# Planejamento de Tarefas — Estabilização de IA & Atribuição & Regras por Foco

Este plano estabelece a checklist operacional e memória de estabilização para corrigir copies genéricas da IA, persistir a cadência estruturada por lead e aplicar regras comportamentais a todos os 11 focos.

---

## 🏗️ Fases do Projeto (Protocolo V.L.A.E.G.)

### 🟢 Fase 1: Visão e Lógica (Descoberta & Planejamento)
- [x] Analisar o comportamento da Edge Function `analisar-lead-ia` e o fluxo de IA em `LeadsList.tsx`.
- [x] Criar o plano de implementação em `implementation_plan.md` no diretório de artefatos.
- [x] Atualizar a Constituição do Projeto em `gemini.md`.
- [x] Obter as respostas do usuário para as Perguntas de Descoberta e aprovação do Blueprint.

### ⚡ Fase 2: Link e Conectividade
- [x] Validar acessos a tabelas de logs e conectividade da Edge Function `/analisar-lead-ia`.
- [x] Certificar CORS e respostas de erro estruturadas da Edge Function.

### ⚙️ Fase 3: Desenvolvimento Arquitetural (A.N.T.)

#### Camada 1: POPs Técnicos (`architecture/`)
- [x] Criar/atualizar definições de regras comportamentais dos 11 focos comerciales em `focusBehavior.ts`.

#### Camada 2: Navegação e Componentes (Frontend)
- [x] **normalizeLead.ts:** Adicionar helper `normalizePlanoProspeccao` para converter formato de objeto estruturado em array de 7 dias de forma transparente.
- [x] **useSecureLeads.ts:** Integrar normalização do plano de prospecção do lead.
- [x] **LeadsSalvos.tsx:** Garantir normalização robusta do plano de prospecção ao mapear leads salvos.
- [x] **LeadPlanDialog.tsx:** Aplicar normalizador no lead atualizado retornado após reanálise.

36: #### Camada 3: Ferramentas / Edge Functions
37: - [ ] **analisar-lead-ia (index.ts):** Ajustar o catch para retornar JSON de erro estruturado completo e garantir CORS em OPTIONS e falhas.
38: 
39: ### 🔄 Fase 5: Busca Incremental & Persistência de Filtros (Nova Solicitação)
40: - [ ] **Persistência de Dados no Formulário (`ProspeccaoForm.tsx`):**
41:   - Salvar o objeto `FormData` completo no `localStorage` ao efetuar qualquer busca bem-sucedida.
42:   - Recuperar esse objeto na montagem do componente, aplicar `reset(savedData)` e ativar `showRepeatButton = true` com `lastSearchParams`.
43: - [ ] **Comunicação por Eventos (`ProspeccaoForm.tsx`):**
44:   - Escutar o evento `"triggerIncrementalSearch"` e acionar a busca incremental a partir dele.
45: - [ ] **Botão Premium na Tabela (`LeadsList.tsx`):**
46:   - Adicionar o botão "Prospectar mais leads" no cabeçalho da tabela caso existam leads e haja busca anterior em `localStorage`.
47:   - Configurar o clique para disparar o CustomEvent e sincronizar o estado `isSearching` para exibir loader e desabilitar o clique.
48: 
49: ---

### 🔄 Fase 6: Resolução de Assinaturas Pro e listUsers (Solicitação Atual)
- [x] **SQL de Correção (Banco de Dados):**
  - [x] Criar RPC `get_user_id_by_email` no Postgres para consultar `auth.users` diretamente por e-mail de forma indexada.
  - [x] Criar script corretivo para atualizar a assinatura dos e-mails `falecom@klsalescompany.com` e `zunopropect@gmail.com` para o plano `pro` ativo.
- [x] **Ajuste nos Webhooks e Despachadores (Edge Functions):**
  - [x] **stripe-webhook/index.ts:** Substituir o `listUsers` pela chamada à RPC `get_user_id_by_email` com fallback secundário.
  - [x] **kiwify-webhook/index.ts:** Substituir o `listUsers` pela chamada à RPC `get_user_id_by_email` com fallback secundário.
  - [x] **process-behavior-emails/index.ts:** Implementar loop de paginação no `listUsers` para varrer 100% dos usuários.
  - [x] **send-onboarding-email/index.ts:** Implementar loop de paginação ou obter e-mail diretamente.
#### Camada 3: Ferramentas / Edge Functions (Backend)
- [x] **focusBehavior.ts:** Declarar o mapa central `FOCUS_BEHAVIOR_MAP` e as funções auxiliares `getFocusBehavior` e `replacePlaceholders`.
- [x] **index.ts:**
  - Importar o módulo `focusBehavior.ts`.
  - Injetar `focusBehaviorRules` e a instrução crítica obrigatória nos prompts de IA.
  - Reescrever `buildFallbackProspectingPlan` para gerar mensagens de fallback por foco dinamicamente.
  - Ajustar `applyQualityFallbackIfNeeded` para validar termos proibidos e promessas de forma balanceada.
  - Criar helper `convertToPersonalizedCadence` para estruturar o payload no formato JSONB da Zuno.
  - Atualizar o salvamento no banco de dados da tabela `leads` para persistir o plano formatado por lead.
  - Atualizar o retorno HTTP para enviar a chave `plano_prospeccao` estruturada com `success` e `lead_id`.

---

50: 
51: ## 🛠️ Checklist de Testes Obrigatórios
52: 
53: - [ ] **Teste 1 (IA com sucesso):** Clicar em "Gerar abordagem com IA", confirmar loader, desabilitação, 1 request, sucesso gera abordagem e consome 1 crédito.
54: - [ ] **Teste 2 (IA com falha):** Simular falha na API, confirmar erro amigável, crédito mantido intacto, botão liberado para tentar novamente.
55: - [ ] **Teste 3 (Duplo clique):** Testar cliques rápidos concorrentes, confirmar prevenção de chamadas adicionais e evento `AI_Analysis_Duplicate_Click_Prevented`.
56: - [ ] **Teste 4 (Alerta de prejuízo):** Validar exibição do Alerta Crítico vermelho com 3+ falhas e 0 sucessos no painel e na atividade ao vivo.
57: - [ ] **Teste 5 (Touch Inferido):** Confirmar exibição de UTMs e criativos inferidos de eventos para profiles vazios.
58: - [ ] **Teste 6 (Persistência & Busca Incremental):**
59:   - Preencher o formulário, buscar, atualizar a página e verificar se o form continua preenchido.
60:   - Clicar em "Prospectar mais leads" no cabeçalho da tabela e verificar se novos leads são incrementados corretamente sem limpar a tabela.
61: - [ ] **Teste de Compilação:** Executar `npm run build` na pasta `ZunoProspect-github` e atestar que compila sem erros.

---

### 🔄 Fase 7: Categoria de Serviços Profissionais (Solicitação Atual)
- [ ] **Frontend - Configuração da Categoria:**
  - [ ] Adicionar `"servicos_profissionais"` à união `Foco` em `src/types/lead.ts`.
  - [ ] Mapear `{ label: "Serviços Profissionais", value: "servicos_profissionais" }` em `focusOptions` de `ProspeccaoForm.tsx`.
  - [ ] Estender interface `NormalizedLead` e atualizar `normalizeLeadForAI` em `src/utils/normalizeLead.ts` para enviar o payload completo.
- [ ] **Backend - Adaptação da Edge Function (`analisar-lead-ia`):**
  - [ ] Estender interface `LeadData` e atualizar `normalizeLeadForAI` do backend.
  - [ ] Ajustar `getInferredContext` para posicionar `servicos_profissionais` no topo.
  - [ ] Adicionar argumentação e diretrizes estruturadas em `getFocoArguments` e `getFocoArgumentsUS`.
  - [ ] Adaptar `buildEliteCopywriterSystemPrompt`, `buildBRSystemPrompt` e `buildUSSystemPrompt` para receber `foco` e redefinir a especialidade do copywriter de elite.
  - [ ] Atualizar `buildStrategicDiagnosisBullets` com os bullets específicos de Serviços Profissionais.

---

## 🛠️ Checklist de Testes de Serviços Profissionais

- [ ] **Teste de Busca e Categoria:** Buscar por "advogados de inventário" em "Vila Velha" com o foco "Serviços Profissionais", e confirmar que os leads são salvos com `foco: "servicos_profissionais"`.
- [ ] **Teste de Diagnóstico (IA):** Gerar a análise com IA para o corretor/avaliador de imóveis e verificar se o diagnóstico cita partilha, inventário, e conexão técnica de utilidade sem agressividade digital.
- [ ] **Teste de Cadência (IA):** Verificar se a cadência de 7 dias se baseia em parcerias e indicações, sem citar tráfego pago, funil, social media, criativos ou anúncios.

---

### 🔄 Fase 8: Logout no Checkout (Concluído)
- [x] **Frontend - Checkout.tsx:**
  - [x] Importar o ícone `LogOut` do `lucide-react`.
  - [x] Desestruturar `signOut` de `useAuth()`.
  - [x] Criar o método `handleSignOut` que chama `signOut` do hook de autenticação e exibe toast de sucesso.
  - [x] Substituir o `useEffect` de carregamento estático inicial por um `useEffect` reativo baseado em `user` do `useAuth()` para sincronizar e limpar estados do form de forma segura.
  - [x] Adicionar botão "Sair da conta" no Header do Checkout quando `hasSession` for `true`.
  - [x] Adicionar link "Usar outra conta" no label/topo do campo E-mail no formulário de Checkout quando `hasSession` for `true`.

---

## 🛠️ Checklist de Testes de Logout no Checkout (Concluído)

- [x] **Teste de Exibição:** Entrar no Checkout com sessão ativa e validar que o botão "Sair da conta" aparece no header e o link "Usar outra conta" aparece acima do campo de e-mail.
- [x] **Teste de Ação de Logout:** Clicar em "Sair da conta" ou "Usar outra conta", confirmar que a sessão é limpa, um toast de sucesso é exibido e a tela volta a mostrar o formulário de cadastro/login com campo de senha e botão do Google.

---

### 🔄 Fase 9: Fluxo de Navegação e Redirecionamento da LP (Solicitação Atual)
- [ ] **Frontend - Precos.tsx:**
  - [ ] Alterar o link "Voltar ao site" para incluir o parâmetro de query `no_redirect=true` (`to="/?no_redirect=true"`).
- [ ] **Frontend - LandingProspeccaoIA.tsx:**
  - [ ] Ler o parâmetro `no_redirect` do hook `useSearchParams()`.
  - [ ] Blindar a lógica de verificação de autenticação (`checkAuth` e `onAuthStateChange`) para NÃO redirecionar o usuário se o parâmetro `no_redirect` for verdadeiro.

---

## 🛠️ Checklist de Testes de Fluxo de Navegação

- [ ] **Teste de Redirecionamento Normal:** Acessar a raiz `/` com sessão ativa e sem parâmetro. Validar que o usuário continua sendo redirecionado para `/prospeccao`.
- [ ] **Teste de Voltar do Checkout para Preços:** No Checkout, clicar em "Voltar para planos". Validar que a pessoa vai para `/precos`.
- [ ] **Teste de Voltar da Página de Preços para a LP (Logado):** Na página de preços `/precos`, com o usuário logado, clicar em "Voltar ao site". Validar que o usuário é redirecionado para `/?no_redirect=true` e a LP institucional é exibida sem ser redirecionado para `/prospeccao`.


- [x] **Teste de Build:** Executar `npm run build` na pasta `reach-gen` e atestar que compila sem erros.
- [x] **Teste de Validação de Focos:** Garantir que o mapa `FOCUS_BEHAVIOR_MAP` contemple as diretrizes e CTAs de todos os focos comerciais.
- [x] **Teste de Persistência:** Confirmar que a Edge Function persiste o objeto estruturado JSONB individualmente por lead no banco de dados.
- [x] **Teste de Normalização do Frontend:** Assegurar que o frontend consegue ler e exibir a cadência de 7 dias a partir do objeto JSONB de forma transparente.


---

### Fase 12: Personalizacao por Maturidade Comercial (Prototipo Local Isolado)

#### Camada 1: Arquitetura e Contrato de Dados
- [x] Definir tipo CommercialMaturity: equilibrado | iniciante | intermediario | avancado em src/types/commercialMaturity.ts e em _shared/lead-analysis.ts.
- [x] Estender SellerProfile com commercial_maturity?: CommercialMaturity (fallback neutro: equilibrado).
- [x] Garantir que o fallback neutro nao rotule o usuario compulsoriamente como iniciante.

#### Camada 2: Navegacao e Componentes
- [x] LeadPlanDialog.tsx: Adicionar prop commercialMaturity e seletor visual sutil.
- [x] LeadAnalysis.tsx: Propagar commercialMaturity para calculo de NBA e exibir badge.

#### Camada 3: Motor Deterministico e Demonstracao
- [x] nextBestAction.ts: Adaptar reason e guidance para os 4 niveis (equilibrado, iniciante, intermediario, avancado).
- [x] DemoPlanoIA.tsx: Adicionar painel interativo com 4 botoes.
- [x] Testes Automatizados: Suite completa vitest.

---

### Fase 13: Refinamento de Oferta Comercial com Pergunta Única Contextual

#### Camada 1: Arquitetura e Contrato de Dados
- [x] Criar helper determinístico src/lib/offerClarification.ts para avaliar se o perfil comercial está suficientemente claro ou se necessita de pergunta única.
- [x] Gerar pergunta curta, contextual e específica (ex: 'Qual problema sua automação resolve para o tipo de empresa que você quer atender?'), sem chamadas a LLM ou consumo de créditos.
- [x] Tratar caso de 'Continuar sem responder' com postura exploratória prudente, sem inventar benefícios.

#### Camada 2: Componente e Navegação
- [x] Criar componente de intervenção leve OfferClarificationDialog.tsx e integrar no fluxo pré-refinamento de LeadPlanDialog.tsx.
- [x] Permitir resposta curta com salvamento direto em offer_description no SellerProfile.
- [x] Permitir botão 'Continuar sem responder' sem bloquear a geração.

#### Camada 3: Demonstração e Comparativo no Demo Local
- [x] Em DemoPlanoIA.tsx, adicionar toggle/seletor de cenário:
  - Cenário A: Perfil suficientemente detalhado (segue direto para geração).
  - Cenário B: Perfil incompleto (apresenta a pergunta contextual única).
- [x] Criar testes unitários para a avaliação de clareza de oferta e geração da pergunta em src/lib/offerClarification.test.ts e OfferClarificationDialog.test.tsx.
- [x] Executar suíte completa vitest (743/743 testes passando) e registrar evidências visuais via CDP.

---

### Fase 14: Auditoria Final de Prontidão para Produção (GO / NO-GO) & Congelamento de Código
- [x] **Auditoria de Branches e Worktrees:** Mapeadas divergências entre `feat/refinamento-completo-ia`, `fix/fluxo-compra-sem-friccao`, `feat/onboarding-primeira-busca` e `main`.
- [x] **Auditoria do Fluxo do Assinante:** Verificado cadastro, trial de 7 dias, checkout Stripe/Mercado Pago e ativação via webhooks.
- [x] **Auditoria de IA, Busca e Créditos:** Identificado bloqueio crítico de dependência da tabela `seller_profiles` na Edge Function `analisar-lead-ia`.
- [x] **Auditoria de Separação Demo vs Prod:** Validado isolamento estrito via `import.meta.env.DEV`, sem bypass em produção.
- [x] **Auditoria de Segurança e RLS:** Validado RLS, restrição server-side de SDR e segredos protegidos.
- [x] **Auditoria de Qualidade Comercial:** Validada cadência inteligente de 7 dias, NBA com 7 regras e opt-out.
- [x] **Levantamento de Funcionalidades Incompletas:** Documentada a ausência de calendário visual e divergência de rota no pg_cron.
- [x] **Validação Técnica de Build e Testes:** Executado `npm run build` (34s, 100% sucesso) e 743 testes Vitest aprovados.
- [x] **Emissão do Relatório Executivo e Veredito:** Produzido artefato oficial `auditoria-go-no-go.md` com veredito NO-GO imediato ➔ GO em 4 passos.

---

### Fase 15: Convergência para Lançamento (Release Candidate v1.0)
- [x] **Branch Release Candidate:** Criada branch `release/v1.0` consolidada e isolada.
- [x] **Checkout Sem Fricção Integrado:**
  - [x] Migração de `ProtectedRoute.tsx`, `useOAuthCallback.ts`, `Auth.tsx`, `Checkout.tsx`, `PrecosSection.tsx`.
  - [x] Execução de 26 testes de checkout em `seamlessCheckoutFlow.test.ts` (100% aprovados).
- [x] **Auditoria e Migrations de Banco:**
  - [x] Auditoria de `seller_profiles`: compatibilização com coluna `commercial_maturity`.
  - [x] Criação de `supabase/migrations/20261031120000_create_seller_profiles.sql`.
  - [x] Criação de `supabase/migrations/20261031130000_disable_legacy_cron_process_emails.sql` (desativação idempotente de cron job legado).
  - [x] Criação de `supabase/migrations/20261031140000_sdr_lead_guard.sql` (trigger de proteção do módulo SDR no banco).
  - [x] Garantia: NENHUMA migration aplicada no Supabase remoto/produção.
- [x] **Validação Técnica do Release Candidate:**
  - [x] Typecheck `npx tsc --noEmit` aprovado (0 erros).
  - [x] Suíte Vitest completa: 60 arquivos e 769 testes aprovados (100% de sucesso).
  - [x] Build de produção `npm run build` aprovado.
- [x] **Homologação E2E Isolada:**
  - [x] Criação de runbook detalhado e matriz de testes end-to-end (10 cenários críticos).
- [x] **Auditoria e Posicionamento da Landing Page:**
  - [x] Alinhamento nos 5 pilares comerciais reais.
  - [x] Eliminação de promessas de automações inexistentes.

---

### Fase 16: Homologação Integrada RC-1 & Padronização da Marca Zuno Prospect
- [x] **Padronização da Marca (`Zuno Prospect`):** Corrigida a grafia pública em `Logo.tsx`, `index.html`, Landing Page, Checkout, Prospeccao, ReferralCard, WhatsApp e templates de e-mail (preservando domínio técnico `zunopropect.com.br`).
- [x] **Sincronização de `commercial_maturity` no Perfil Real:** Adicionado seletor opcional em `SellerProfileDialog.tsx` e propagação automática em `LeadPlanDialog.tsx`.
- [x] **Revisão de Migrations (Permissões, Impacto, Reversibilidade e Ordem):**
  - [x] `20261031120000_create_seller_profiles.sql`: Adicionado `grant ... to authenticated, service_role`, `add column if not exists commercial_maturity` e instruções de rollback.
  - [x] `20261031130000_disable_legacy_cron_process_emails.sql`: Desativação idempotente com instruções de rollback.
  - [x] `20261031140000_sdr_lead_guard.sql`: Trigger de bloqueio SDR com `grant execute` e instruções de rollback.
- [x] **Suíte de Homologação Integrada Isolada (`homologacaoIntegradaRC1.test.ts`):** 61 arquivos de teste e 779 testes aprovados (100% em memória, zero consumo de créditos reais ou toque em produção).
- [x] **Registro Transparente de Impedimento de Infraestrutura Staging:** Documentada a ausência de projeto Supabase/Stripe de staging separado e Docker daemon desligado localmente, sem usar produção como substituto.
