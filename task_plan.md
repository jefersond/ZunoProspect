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
