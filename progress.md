# Registro de Progresso — IA & Atribuição de Origem

Este arquivo acompanha as iterações, erros analisados, correções efetuadas e resultados de homologação para blindagem da IA e correção da atribuição multitoque no Zuno Propect.

---

## 🚀 Estado Atual (02/06/2026)

- **Fase de Planejamento:** Identificadas falhas críticas relatadas por usuários pagos vindo de campanhas Meta Ads que não conseguem rodar análises de IA consecutivas.
- **Mapeamento Concluído:**
  - Lógica de IA e controle de concorrência em `LeadsList.tsx`.
  - Atribuição multitoque no profile e inferência de eventos em `AdminRealtime.tsx`.
  - Tratamento de CORS, OPTIONS e erros na Edge Function `analisar-lead-ia`.
  - Mapeamento de criativos de campanhas Meta Ads em `creativeMap.ts`.

---

## 📈 Histórico de Atividades e Iterações

### Iteração 1: Inicialização do Protocolo V.L.A.E.G. (Modo Planejamento)
- [x] Criação do plano de implementação premium `implementation_plan.md` no diretório de artefatos.
- [x] Atualização da Constituição do Projeto em `gemini.md` no workspace.
- [x] Criação e atualização de `task_plan.md`, `findings.md` e `progress.md` no workspace de trabalho.
- [x] Obter respostas de descoberta e aprovação do Blueprint pelo usuário.

### Iteração 2: Busca Incremental & Persistência de Filtros (04/06/2026)
- [x] Salvar `FormData` em `localStorage` sob a chave `"zuno_last_search_form_data"`.
- [x] Implementar `reset` e restabelecimento de estados no formulário na montagem do componente.
- [x] Adicionar listener do CustomEvent `"triggerIncrementalSearch"` para acionar a busca incremental.
- [x] Criar o botão premium `"Buscar mais leads"` no cabeçalho de `LeadsList.tsx`.
- [x] Mesclar os leads no topo no frontend e recarregar todos os leads não salvos de forma determinística na conclusão.
- [x] Validar que o build de produção passou com 100% de sucesso.

---

## 📊 Acompanhamento Técnico de Bugs (IA & Atribuição)

| Bug Relatado / Funcionalidade | Causa Provável | Ação Efetuada | Status |
| :--- | :--- | :--- | :--- |
| **1. Falhas críticas de IA para usuários pagos** | Instabilidades na API do Gemini ou cota da chave esgotada, gerando erros não tratados. | Blindar Edge Function, retornar JSON estruturado rico e tratar no frontend com erros amigáveis. | ⏳ Planejado |
| **2. Atribuição First/Last Touch vazia** | Falhas na sincronização do profile via localStorage ou navegação anônima sem UTMs salvas. | Implementar inferência de UTMs baseada no histórico de eventos (`app_events`) na tela do admin. | ⏳ Planejado |
| **3. Cliques duplicados consumindo cota** | Cliques repetidos rápidos chamando a Edge Function simultaneamente. | Adicionar desabilitação e controle síncrono por `lead_id` no frontend. | ⏳ Planejado |
| **4. ID numérico de criativo no admin** | Criativos do Meta Ads aparecendo como IDs brutos sem mapeamento legível. | Adicionar o ID `120248028635250725` no `CREATIVE_NAME_MAP`. | ⏳ Planejado |
| **5. Busca Incremental & Repetição** | Perda de filtros após reload e necessidade de buscar mais sem limpar a lista. | Persistência no `localStorage`, disparo via eventos customizados e mesclagem de novos leads no topo. | ✅ Concluído |
| **6. Assinaturas Pro exibidas como Free (falecom e zunopropect)** | Limite de paginação (50) no `listUsers` do Supabase causou falha silenciosa de localização do usuário nos webhooks do Stripe/Kiwify. | Mapeada a causa raiz, elaborado plano de implementação, criada a RPC SQL e desenhado os ajustes nas Edge Functions. | ⏳ Planejado |
| **7. Redirecionamento indevido no checkout** | Link de voltar para planos apontava para a home que força redirecionamento de usuários logados. | Modificado o link de `to="/#precos"` para `to="/precos"` no cabeçalho do Checkout. | ✅ Concluído |
| **8. Modal do Kiwify no Perfil** | Arquivo antigo do clone reach-gen possuía modal do Kiwify hardcoded no botão Gerenciar. | Unificado o Profile.tsx de reach-gen para chamar o Stripe Customer Portal diretamente, e limpo o modal antigo. | ✅ Concluído |

---

## 🚀 Estado Atual (08/06/2026)
- **Fase de Implantação Concluída:** Deploy de 100% das Edge Functions afetadas realizado no servidor Supabase de produção.
- **Ações Efetuadas:**
  - [x] Criada a migração para a RPC SQL `get_user_id_by_email` no repositório.
  - [x] Deploy das Edge Functions `stripe-webhook`, `kiwify-webhook`, `process-behavior-emails` e `send-onboarding-email` realizado com sucesso no Supabase remoto.
  - [x] Elaborado o script SQL consolidado para criação da RPC e ativação das assinaturas Pro dos e-mails `falecom@klsalescompany.com` e `zunopropect@gmail.com` para execução manual no painel do Supabase.
  - [x] Executada consulta direta no banco de dados de produção comprovando que as assinaturas Pro das contas `zunopropect@gmail.com` e `falecom@klsalescompany.com` estão 100% ativas com limites de 800 leads e 100 análises de IA.
  - [x] Diagnosticada a causa do visual ainda estar exibindo "20 leads e 3 análises" (plano Free): erro de sintaxe/API do Supabase Client no frontend (`rpc().catch is not a function` quebrando o `Promise.all` e forçando fallback para Free).
  - [x] Corrigido o bug de sintaxe em `src/hooks/useSubscription.ts` e `src/hooks/useUsage.ts` envolvendo a chamada RPC em uma IIFE assíncrona segura.
  - [x] Resolvidos conflitos de git merge locais e efetuado o pull completo com a branch principal do GitHub.
  - [x] Efetuado o build local bem-sucedido e realizado o deploy de produção forçado na Vercel com a versão corrigida (100% online no domínio oficial).
  - [x] Diagnosticado o erro `Uncaught (in promise) Error: A listener indicated...` no console do usuário como um falso positivo causado por extensões do Chrome (content scripts) e sem relação com a falha de melhoria de copy.
  - [x] Realizado o deploy remoto atualizado da Edge Function `analisar-lead-ia` para o Supabase remoto, aplicando todas as otimizações e prompts de melhoria de copy que estavam pendentes no Git local.
  - [x] Identificado erro de compilação da Edge function no deploy do Supabase devido a uma chave de fechamento sobressalente `}` na linha 920. Resolvido o syntax error e deploy finalizado com sucesso.
  - [x] Identificada a causa raiz do não envio de variáveis de campanha (oferta_usuario, dor_principal, publico_alvo, objetivo) ao Gemini: a assinatura de tipos de `buildEliteUserPrompt` não aceitava nem propagava o terceiro argumento `injectedCampaign` para as funções internas de geração do prompt (`buildBRUserPrompt` e `buildUSUserPrompt`).
  - [x] Corrigidas as assinaturas de `buildEliteUserPrompt`, `buildBRUserPrompt` e `buildUSUserPrompt` na Edge Function `analisar-lead-ia` para receber e injetar adequadamente as diretrizes da campanha nos prompts do Gemini Flash.
  - [x] Implementada a normalização resiliente de `plano_prospecao_7dias` nos 4 arquivos do frontend (`LeadPlanDialog.tsx`, `LeadsList.tsx`, `useSecureLeads.ts` e `LeadsSalvos.tsx`) para aceitar tanto planos de prospecção legados (arrays puros) quanto novos planos estruturados com metadados (objetos contendo a chave `plano_prospeccao_7dias`), prevenindo erros catastróficos em runtime (como `.map is not a function`).
  - [x] Validado com sucesso o build de produção local do frontend React (`npm run build`).
  - [x] **Iteração 8 (08/06/2026):** Identificado e corrigido erro de CORS no console ao chamar "Refinar com IA". A causa raiz era o sombreamento e escopo inadequado da variável `leadData` (declarada com `let` dentro do `try` e referenciada no `catch` global), lançando um `ReferenceError` que quebrava síncronamente o bloco `catch` e impedia o Supabase Gateway (Kong) de anexar os headers CORS ao erro 500 resultante. Movida a declaração de `leadData` para o topo do `serve`.
  - [x] Efetuado o deploy da correção no Supabase e enviado para o GitHub remoto (com build passando sem erros).
  - [x] **Iteração 9 (08/06/2026): Auditoria completa de fluxos de erro para todos os usuários.**
    - Auditados todos os caminhos de erro na Edge Function `analisar-lead-ia` (CORS, 401, 400, 402, 403, 408, 500).
    - **Identificado desalinhamento crítico de `error_code`:** Backend retornava `AI_CREDITS_EXHAUSTED` mas frontend verificava apenas `AI_LIMIT_REACHED`. Corrigido em 3 arquivos frontend (`LeadPlanDialog.tsx`, `LeadsList.tsx`, `LeadsSalvos.tsx`) para reconhecer ambos os códigos + campo `blocked`.
    - **Corrigido fluxo de `increment_ai_usage`:** Quando o incremento falhava, o backend retornava 402 mesmo com a análise já salva no banco, gerando uma experiência confusa (lead atualizado mas toast de "erro"). Agora retorna sucesso com `credit_warning`.
    - **Corrigido status HTTP no catch global:** Erros de crédito agora retornam 402 (não 500), payload inválido retorna 400, timeout retorna 408. Isso melhora a semântica e permite que o frontend trate cada caso corretamente.
    - **Adicionado campo `blocked: true`** na resposta de erro de créditos para detecção mais robusta no frontend.
    - Build de produção validado com sucesso.
  - [x] **Iteração 10 (08/06/2026): Resolução do Falso Positivo de Crédito e Investigação de Rate Limit do Gemini.**
    - Identificada a causa raiz do erro de crédito persistente: a mensagem padrão de erro genérico da Edge Function continha a palavra `"crédito"`, o que ativava o `isBalanceError` no frontend via `includes("crédito")`.
    - Corrigido `isBalanceError` em `LeadsList.tsx`, `LeadPlanDialog.tsx` e `LeadsSalvos.tsx` para usar checagens específicas e baseadas no `error_code` estruturado.
    - Alterada a mensagem de erro genérica do backend para `"Não conseguimos concluir a análise agora. O uso de IA não foi descontado. Tente novamente em alguns instantes."` (sem a palavra crédito/saldo/limite).
    - Consultados os logs na nuvem via Supabase CLI (`--linked` em `app_events`), revelando que o erro técnico real é `"Rate limit excedido após 3 tentativas"`.
    - Aumentada a resiliência no `fetchWithRetry` do backend para realizar até 5 tentativas com delays mais adequados de backoff contra rate limits temporários da API da Google.
    - Executado o build de produção no frontend com 100% de sucesso.
    - Efetuado o deploy da nova Edge Function atualizada no Supabase remoto e commitado as correções no Git.
  - [x] **Iteração 11 (08/06/2026): Correção de Descontinuação do Gemini 2.0 Flash (Erro 404) e Cascata de Fallback.**
    - Identificada a causa do erro de reanálise persistente pós-deploy: o modelo `gemini-2.0-flash` foi descontinuado oficialmente pela Google em 1º de junho de 2026, retornando status HTTP `404` para a nossa chamada.
    - Implementada uma **cascata resiliente de modelos em loop de fallback** no backend (`gemini-3.5-flash` -> `gemini-2.5-flash` -> `gemini-1.5-flash` -> `gemini-2.0-flash`) com tratamento de erro 404 síncrono.
    - Efetuado deploy atualizado da Edge Function no Supabase de produção.
    - Commits adicionados e enviados ao repositório remoto GitHub com sucesso.
  - [x] **Iteração 12 (15/06/2026): Ajuste do Link de Retorno no Checkout.**
    - Identificada a causa de redirecionamento automático de usuários logados para a home e depois `/prospeccao` (dashboard) com exibição de plano Free.
    - Corrigido o link em `Checkout.tsx` para apontar diretamente para a rota pública `/precos`.
# Registro de Progresso — IA & Atribuição de Origem

Este arquivo acompanha as iterações, erros analisados, correções efetuadas e resultados de homologação para blindagem da IA e correção da atribuição multitoque no Zuno Propect.

---

## 🚀 Estado Atual (02/06/2026)

- **Fase de Planejamento:** Identificadas falhas críticas relatadas por usuários pagos vindo de campanhas Meta Ads que não conseguem rodar análises de IA consecutivas.
- **Mapeamento Concluído:**
  - Lógica de IA e controle de concorrência em `LeadsList.tsx`.
  - Atribuição multitoque no profile e inferência de eventos em `AdminRealtime.tsx`.
  - Tratamento de CORS, OPTIONS e erros na Edge Function `analisar-lead-ia`.
  - Mapeamento de criativos de campanhas Meta Ads em `creativeMap.ts`.

---

## 📈 Histórico de Atividades e Iterações

### Iteração 1: Inicialização do Protocolo V.L.A.E.G. (Modo Planejamento)
- [x] Criação do plano de implementação premium `implementation_plan.md` no diretório de artefatos.
- [x] Atualização da Constituição do Projeto em `gemini.md` no workspace.
- [x] Criação e atualização de `task_plan.md`, `findings.md` e `progress.md` no workspace de trabalho.
- [x] Obter respostas de descoberta e aprovação do Blueprint pelo usuário.

### Iteração 2: Busca Incremental & Persistência de Filtros (04/06/2026)
- [x] Salvar `FormData` em `localStorage` sob a chave `"zuno_last_search_form_data"`.
- [x] Implementar `reset` e restabelecimento de estados no formulário na montagem do componente.
- [x] Adicionar listener do CustomEvent `"triggerIncrementalSearch"` para acionar a busca incremental.
- [x] Criar o botão premium `"Buscar mais leads"` no cabeçalho de `LeadsList.tsx`.
- [x] Mesclar os leads no topo no frontend e recarregar todos os leads não salvos de forma determinística na conclusão.
- [x] Validar que o build de produção passou com 100% de sucesso.

---

## 📊 Acompanhamento Técnico de Bugs (IA & Atribuição)

| Bug Relatado / Funcionalidade | Causa Provável | Ação Efetuada | Status |
| :--- | :--- | :--- | :--- |
| **1. Falhas críticas de IA para usuários pagos** | Instabilidades na API do Gemini ou cota da chave esgotada, gerando erros não tratados. | Blindar Edge Function, retornar JSON estruturado rico e tratar no frontend com erros amigáveis. | ⏳ Planejado |
| **2. Atribuição First/Last Touch vazia** | Falhas na sincronização do profile via localStorage ou navegação anônima sem UTMs salvas. | Implementar inferência de UTMs baseada no histórico de eventos (`app_events`) na tela do admin. | ⏳ Planejado |
| **3. Cliques duplicados consumindo cota** | Cliques repetidos rápidos chamando a Edge Function simultaneamente. | Adicionar desabilitação e controle síncrono por `lead_id` no frontend. | ⏳ Planejado |
| **4. ID numérico de criativo no admin** | Criativos do Meta Ads aparecendo como IDs brutos sem mapeamento legível. | Adicionar o ID `120248028635250725` no `CREATIVE_NAME_MAP`. | ⏳ Planejado |
| **5. Busca Incremental & Repetição** | Perda de filtros após reload e necessidade de buscar mais sem limpar a lista. | Persistência no `localStorage`, disparo via eventos customizados e mesclagem de novos leads no topo. | ✅ Concluído |
| **6. Assinaturas Pro exibidas como Free (falecom e zunopropect)** | Limite de paginação (50) no `listUsers` do Supabase causou falha silenciosa de localização do usuário nos webhooks do Stripe/Kiwify. | Mapeada a causa raiz, elaborado plano de implementação, criada a RPC SQL e desenhado os ajustes nas Edge Functions. | ⏳ Planejado |
| **7. Redirecionamento indevido no checkout** | Link de voltar para planos apontava para a home que força redirecionamento de usuários logados. | Modificado o link de `to="/#precos"` para `to="/precos"` no cabeçalho do Checkout. | ✅ Concluído |
| **8. Modal do Kiwify no Perfil** | Arquivo antigo do clone reach-gen possuía modal do Kiwify hardcoded no botão Gerenciar. | Unificado o Profile.tsx de reach-gen para chamar o Stripe Customer Portal diretamente, e limpo o modal antigo. | ✅ Concluído |

---

## 🚀 Estado Atual (08/06/2026)
- **Fase de Implantação Concluída:** Deploy de 100% das Edge Functions afetadas realizado no servidor Supabase de produção.
- **Ações Efetuadas:**
  - [x] Criada a migração para a RPC SQL `get_user_id_by_email` no repositório.
  - [x] Deploy das Edge Functions `stripe-webhook`, `kiwify-webhook`, `process-behavior-emails` e `send-onboarding-email` realizado com sucesso no Supabase remoto.
  - [x] Elaborado o script SQL consolidado para criação da RPC e ativação das assinaturas Pro dos e-mails `falecom@klsalescompany.com` e `zunopropect@gmail.com` para execução manual no painel do Supabase.
  - [x] Executada consulta direta no banco de dados de produção comprovando que as assinaturas Pro das contas `zunopropect@gmail.com` e `falecom@klsalescompany.com` estão 100% ativas com limites de 800 leads e 100 análises de IA.
  - [x] Diagnosticada a causa do visual ainda estar exibindo "20 leads e 3 análises" (plano Free): erro de sintaxe/API do Supabase Client no frontend (`rpc().catch is not a function` quebrando o `Promise.all` e forçando fallback para Free).
  - [x] Corrigido o bug de sintaxe em `src/hooks/useSubscription.ts` e `src/hooks/useUsage.ts` envolvendo a chamada RPC em uma IIFE assíncrona segura.
  - [x] Resolvidos conflitos de git merge locais e efetuado o pull completo com a branch principal do GitHub.
  - [x] Efetuado o build local bem-sucedido e realizado o deploy de produção forçado na Vercel com a versão corrigida (100% online no domínio oficial).
  - [x] Diagnosticado o erro `Uncaught (in promise) Error: A listener indicated...` no console do usuário como um falso positivo causado por extensões do Chrome (content scripts) e sem relação com a falha de melhoria de copy.
  - [x] Realizado o deploy remoto atualizado da Edge Function `analisar-lead-ia` para o Supabase remoto, aplicando todas as otimizações e prompts de melhoria de copy que estavam pendentes no Git local.
  - [x] Identificado erro de compilação da Edge function no deploy do Supabase devido a uma chave de fechamento sobressalente `}` na linha 920. Resolvido o syntax error e deploy finalizado com sucesso.
  - [x] Identificada a causa raiz do não envio de variáveis de campanha (oferta_usuario, dor_principal, publico_alvo, objetivo) ao Gemini: a assinatura de tipos de `buildEliteUserPrompt` não aceitava nem propagava o terceiro argumento `injectedCampaign` para as funções internas de geração do prompt (`buildBRUserPrompt` e `buildUSUserPrompt`).
  - [x] Corrigidas as assinaturas de `buildEliteUserPrompt`, `buildBRUserPrompt` e `buildUSUserPrompt` na Edge Function `analisar-lead-ia` para receber e injetar adequadamente as diretrizes da campanha nos prompts do Gemini Flash.
  - [x] Implementada a normalização resiliente de `plano_prospecao_7dias` nos 4 arquivos do frontend (`LeadPlanDialog.tsx`, `LeadsList.tsx`, `useSecureLeads.ts` e `LeadsSalvos.tsx`) para aceitar tanto planos de prospecção legados (arrays puros) quanto novos planos estruturados com metadados (objetos contendo a chave `plano_prospeccao_7dias`), prevenindo erros catastróficos em runtime (como `.map is not a function`).
  - [x] Validado com sucesso o build de produção local do frontend React (`npm run build`).
  - [x] **Iteração 8 (08/06/2026):** Identificado e corrigido erro de CORS no console ao chamar "Refinar com IA". A causa raiz era o sombreamento e escopo inadequado da variável `leadData` (declarada com `let` dentro do `try` e referenciada no `catch` global), lançando um `ReferenceError` que quebrava síncronamente o bloco `catch` e impedia o Supabase Gateway (Kong) de anexar os headers CORS ao erro 500 resultante. Movida a declaração de `leadData` para o topo do `serve`.
  - [x] Efetuado o deploy da correção no Supabase e enviado para o GitHub remoto (com build passando sem erros).
  - [x] **Iteração 9 (08/06/2026): Auditoria completa de fluxos de erro para todos os usuários.**
    - Auditados todos os caminhos de erro na Edge Function `analisar-lead-ia` (CORS, 401, 400, 402, 403, 408, 500).
    - **Identificado desalinhamento crítico de `error_code`:** Backend retornava `AI_CREDITS_EXHAUSTED` mas frontend verificava apenas `AI_LIMIT_REACHED`. Corrigido em 3 arquivos frontend (`LeadPlanDialog.tsx`, `LeadsList.tsx`, `LeadsSalvos.tsx`) para reconhecer ambos os códigos + campo `blocked`.
    - **Corrigido fluxo de `increment_ai_usage`:** Quando o incremento falhava, o backend retornava 402 mesmo com a análise já salva no banco, gerando uma experiência confusa (lead atualizado mas toast de "erro"). Agora retorna sucesso com `credit_warning`.
    - **Corrigido status HTTP no catch global:** Erros de crédito agora retornam 402 (não 500), payload inválido retorna 400, timeout retorna 408. Isso melhora a semântica e permite que o frontend trate cada caso corretamente.
    - **Adicionado campo `blocked: true`** na resposta de erro de créditos para detecção mais robusta no frontend.
    - Build de produção validado com sucesso.
  - [x] **Iteração 10 (08/06/2026): Resolução do Falso Positivo de Crédito e Investigação de Rate Limit do Gemini.**
    - Identificada a causa raiz do erro de crédito persistente: a mensagem padrão de erro genérico da Edge Function continha a palavra `"crédito"`, o que ativava o `isBalanceError` no frontend via `includes("crédito")`.
    - Corrigido `isBalanceError` em `LeadsList.tsx`, `LeadPlanDialog.tsx` e `LeadsSalvos.tsx` para usar checagens específicas e baseadas no `error_code` estruturado.
    - Alterada a mensagem de erro genérica do backend para `"Não conseguimos concluir a análise agora. O uso de IA não foi descontado. Tente novamente em alguns instantes."` (sem a palavra crédito/saldo/limite).
    - Consultados os logs na nuvem via Supabase CLI (`--linked` em `app_events`), revelando que o erro técnico real é `"Rate limit excedido após 3 tentativas"`.
    - Aumentada a resiliência no `fetchWithRetry` do backend para realizar até 5 tentativas com delays mais adequados de backoff contra rate limits temporários da API da Google.
    - Executado o build de produção no frontend com 100% de sucesso.
    - Efetuado o deploy da nova Edge Function atualizada no Supabase remoto e commitado as correções no Git.
  - [x] **Iteração 11 (08/06/2026): Correção de Descontinuação do Gemini 2.0 Flash (Erro 404) e Cascata de Fallback.**
    - Identificada a causa do erro de reanálise persistente pós-deploy: o modelo `gemini-2.0-flash` foi descontinuado oficialmente pela Google em 1º de junho de 2026, retornando status HTTP `404` para a nossa chamada.
    - Implementada uma **cascata resiliente de modelos em loop de fallback** no backend (`gemini-3.5-flash` -> `gemini-2.5-flash` -> `gemini-1.5-flash` -> `gemini-2.0-flash`) com tratamento de erro 404 síncrono.
    - Efetuado deploy atualizado da Edge Function no Supabase de produção.
    - Commits adicionados e enviados ao repositório remoto GitHub com sucesso.
  - [x] **Iteração 12 (15/06/2026): Ajuste do Link de Retorno no Checkout.**
    - Identificada a causa de redirecionamento automático de usuários logados para a home e depois `/prospeccao` (dashboard) com exibição de plano Free.
    - Corrigido o link em `Checkout.tsx` para apontar diretamente para a rota pública `/precos`.
    - Executado o build de produção local com 100% de sucesso.
  - [x] **Iteração 13 (15/06/2026): Remoção do Modal da Kiwify e Unificação com Stripe.**
    - Identificado que o workspace continha clones redundantes (`reach-gen` e `ZunoProspect-github`), onde o `reach-gen` ainda possuía o modal antigo da Kiwify.
    - Atualizado o arquivo `src/pages/Profile.tsx` da pasta `reach-gen` para remover o modal da Kiwify e utilizar o Stripe Customer Portal diretamente.
    - [x] Executado o build de produção local em ambos os diretórios com 100% de sucesso.

### Iteração 14: Ajustes Finos de Textos e Clareza do Trial de 7 Dias (17/06/2026)
- [x] Ajustado o cabeçalho explicativo em `PrecosSection.tsx` com as quatro mensagens estruturadas destacadas do trial.
- [x] Atualizado o display de preços dos cards de planos para destacar “Hoje R$0. Depois R$ [preço]/mês.” de forma explícita e elegante, em sintonia com a seleção de faturamento (mensal/anual).
- [x] Padronizado o microcopy abaixo dos botões dos planos para “Cartão necessário • Cancele antes da cobrança” com fonte `text-xs font-semibold` para evitar textos pequenos demais.
- [x] Sincronizado o microcopy abaixo do botão do CTA final em `CTAFinalSection.tsx` para “Hoje R$0 • Cartão necessário • Cancele antes da cobrança” em `text-sm font-semibold`.
- [x] Redesenhada a seção Antes/Depois (`AntesDepoisSection.tsx`) com nova headline concreta: *"Sua prospecção ainda depende de Google, planilha e tentativa?"*.
- [x] Atualizados os itens de comparação das duas colunas (Prospecção no improviso vs Prospecção com a Zuno), simplificando a lógica do array e limpando imports não utilizados do Lucide.
- [x] Alterado o botão principal de CTA do Hero in `HeroSection.tsx` para realizar scroll suave para a tabela de planos (`#precos`) em vez de ir direto para a página de cadastro.
- [x] Alterados os botões de CTA do cabeçalho (`LPHeader.tsx`, desktop e mobile) e do rodapé final (`CTAFinalSection.tsx`) para também realizarem scroll suave até a tabela de planos (`#precos`), criando um fluxo unificado e consistente.
- [x] Redesenhada a seção "Como funciona" (`ComoFuncionaSection.tsx`) transformando-a no coração do produto com o título *"Da busca à abordagem em poucos passos"*, novos 5 passos sequenciais detalhados, um novo simulador completo de interface com 5 estados interativos e uma esteira visual horizontal de prospecção conectando as etapas de ponta a ponta.
- [x] Ajustada a seção de públicos-alvo (`ParaQuemSection.tsx`) sob o título *"Feita para quem precisa prospectar empresas"*, mantendo estritamente os 8 cards requisitados com suas respectivas descrições, sem "Serviços Profissionais", e aplicando um layout limpo de 4 colunas em desktop e empilhado em mobile, com estilo dark premium e hover verde sutil.
- [x] Atualizado o array de FAQs (`FAQ_ITEMS`) em `data.ts` com as 7 perguntas e respostas solicitadas sobre cobrança, cadastramento de cartão de crédito, cancelamento e ausência de garantias de sucesso comercial.
- [x] Executada a compilação de produção (`npm run build`) com 100% de sucesso, sem nenhuma regressão técnica.

### Iteração 15: Refinamento de Contraste e Transparência nos Preços da Seção de Planos (17/06/2026)
- [x] Atualizados os preços recorrentes pós-teste nos cards de planos para exibição em destaque (`text-3xl font-black`) para máxima transparência (ex: *"Depois R$ 47/mês"* no Starter).
- [x] Otimizada a legenda de cobrança recorrente pós-teste em cada plano, diferenciando síncronamente mensal e anual (ex: *"Cobrança automática após o teste de R$ 47/mês"* ou *"Cobrança automática após o teste de R$ 470/ano"*).
- [x] Mantida a coerência e exibição em destaque verde neon do microcopy *"Hoje R$0 por 7 dias"*.
- [x] Validada a compilação de produção do projeto React (`npm run build`) com 100% de sucesso.

### Iteração 16: Fluxo de Recuperação de Pagamento e Bloqueio Amigável de IA (25/06/2026)
- [x] **Banco de Dados:** Criada e aplicada a migração SQL `20260624214700_payment_recovery.sql` adicionando suporte para armazenar status detalhado de cobrança na tabela `user_subscriptions` e `profiles`, além de criar a tabela `payment_recovery_email_logs`.
- [x] **Backend & Webhooks:**
  - [x] Atualizada a Edge Function `stripe-webhook/index.ts` para processar eventos de `invoice.payment_failed` (atraso) e `invoice.paid` (regularização), disparando e-mails de recuperação via Resend e gravando logs de auditoria contra e-mails duplicados.
  - [x] Criada a Edge Function `create-customer-portal-session/index.ts` para iniciar sessões do Stripe Customer Portal com segurança como fallback de pagamento.
- [x] **Frontend & Hooks:**
  - [x] Atualizados os hooks `useSubscription.ts` e `useUsage.ts` para expor novos campos de faturamento e evitar downgrade automático para Free em status `past_due`/`unpaid`.
  - [x] Criado o helper utilitário `subscriptionHelpers.ts` contendo `isPaymentRecoveryRequired` e `canUsePaidFeatures`.
- [x] **Componentes UI & Banners:**
  - [x] Criado o componente `<PaymentRecoveryBanner />` no tema premium escuro com suporte via WhatsApp e ação de atualização via hosted invoice ou portal Stripe.
  - [x] Integrado o banner no topo do Dashboard (`Dashboard.tsx`) e da tela de Prospecção (`Prospeccao.tsx`).
- [x] **Bloqueio de Recursos Pagos:**
  - [x] Impedidas novas buscas em `ProspeccaoForm.tsx` via validação de pagamento pendente e exibição de Toast com botão "Atualizar".
  - [x] Impedida a geração de análises e reanálises com IA em `LeadsList.tsx` (reanalyzeLead), `LeadPlanDialog.tsx` (handleReanalyze) e `LeadsSalvos.tsx` (handleReanalyze), mostrando Toast de pagamento pendente.
- [x] **Validação Técnica:**
  - [x] Executada compilação de produção do frontend (`npm run build`) com 100% de sucesso, livre de erros de tipos ou referências.
