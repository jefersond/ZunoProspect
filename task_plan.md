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


