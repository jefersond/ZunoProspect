# Descobertas e Restrições Técnicas — IA & Atribuição de Origem

Este arquivo centraliza o mapeamento de vulnerabilidades, restrições arquiteturais e hipóteses de falhas para o fluxo de IA e atribuição de tráfego multitoque do Zuno Propect.

---

## 🔍 Mapeamento Técnico de Falhas e Hipóteses

### 1. Desconto de Créditos em Falhas de IA
- **Análise:** A Edge Function `analisar-lead-ia` executa a chamada ao Gemini e realiza o update do lead no banco ANTES de chamar a RPC `increment_ai_usage` (que decrementa os créditos). Assim, se o Gemini falhar, a Edge Function cai no `catch` e não consome créditos do usuário.
- **Vulnerabilidade:** Se a Edge Function retornar sucesso técnico mas com uma resposta ou plano de prospecção vazio ou incompleto devido a uma falha silenciosa do modelo, o crédito seria consumido mesmo com experiência ruim. Blindaremos a Edge Function para validar a qualidade da resposta antes de incrementar o uso, e garantiremos que qualquer exceção não desconte saldo.

### 2. Concorrência e Cliques Redundantes (Duplo clique)
- **Análise:** Se o usuário clicar várias vezes de forma rápida no botão de IA antes que o estado local reflita a desabilitação (ou se houver latência na rede), múltiplas requisições paralelas podem ser enviadas à Edge Function para o mesmo lead, gerando consumo indevido de cota da chave Gemini ou conflitos de banco.
- **Solução:** Implementaremos um controle síncrono no clique por `lead_id` (`reanalyzingLeads` / `analyzingLeadIds`) para ignorar imediatamente qualquer requisição adicional e registrar o evento `AI_Analysis_Duplicate_Click_Prevented` se necessário.

### 3. Seção First & Last Touch Vazia
- **Análise:** A Edge Function `admin-get-users` retorna corretamente todos os campos de atribuição multitoque do `profiles` do usuário. No entanto, se o cadastro for efetuado a partir de dispositivos onde os cookies/localStorage de UTM falharam em sincronizar (ex: em navegação anônima, Safari com bloqueio, ou Google redirect rápido que limpou parâmetros), o profile do usuário é criado com essas colunas vazias.
- **Solução:** No painel ADM (`AdminRealtime.tsx`), quando a atribuição no profile estiver vazia, o sistema varrerá a jornada (`selectedJourney`) para extrair de forma consultiva a primeira e a última ocorrência de UTMs/origens conhecidas. Exibiremos como "First Touch inferido dos eventos", evitando a perda da inteligência de aquisição.

### 4. Mapeamento de Criativos de Tráfego Pago
- **Análise:** Criativos de campanhas Meta Ads chegam como IDs numéricos gigantescos (ex: `120248028635250725`). Sem um mapeamento amigável, o painel do administrador mostra apenas esses números, dificultando a análise de performance.
- **Solução:** Adicionaremos a chave no mapeamento `CREATIVE_NAME_MAP` com um placeholder amigável de identificação que pode ser customizado.


### 5. Busca Incremental & Persistência de Filtros
- **Análise:** Usuários necessitam de uma experiência fluida para prospectar mais leads sob as mesmas diretrizes (cidade, nicho, canais, foco) após obterem resultados iniciais, sem perder o formulário preenchido em caso de recarregamento e sem apagar os leads anteriores (não salvos) da tela.
- **Solução:**
  1. Serialização do formulário (`FormData`) em JSON no `localStorage` (`zuno_last_search_form_data`) em buscas bem-sucedidas.
  2. Implementação do `reset` reativo no frontend para preencher os inputs na montagem.
  3. Desacoplamento via eventos customizados no `window` (`triggerIncrementalSearch`) para que o botão posicionado no cabeçalho da tabela de leads consiga invocar a busca incremental de forma síncrona sem re-renderizar desnecessariamente o componente de listagem.
  4. Lógica de mesclagem no estado do React para garantir que novos leads adicionados fiquem no topo da lista, e recarregamento geral do banco com `searchRunId = undefined` para acumular todos os leads não salvos de uma vez na UI.

---

## 🛠️ Restrições de Produção

- **Preservação de Faturamento:** Nenhuma regra de preços, planos Stripe ou webhooks existentes deve ser modificada.
- **Bypass de Admin:** O e-mail de admin principal (`jeferson.zanotell@gmail.com`) deve possuir bypass imediato de limites e acesso ilimitado.

### 6. Falha de Paginação no listUsers das Edge Functions
- **Análise:** Várias Edge Functions (`stripe-webhook`, `kiwify-webhook`, `process-behavior-emails`, `send-onboarding-email`) utilizam `supabaseAdmin.auth.admin.listUsers()` sem paginação para buscar o ID de um usuário a partir do seu e-mail.
- **Vulnerabilidade:** A chamada `listUsers` padrão do Supabase limita o retorno a no máximo 50 usuários por página. Quando a base de usuários do SaaS ultrapassa 50 usuários, os novos cadastros não aparecem na primeira página e a busca por e-mail no webhook falha.
- **Consequência:** Os usuários pagantes (`falecom@klsalescompany.com` e `zunopropect@gmail.com`) tiveram a assinatura processada pelo webhook mas o `user_id` não foi localizado na lista truncada de 50 usuários, mantendo as contas em fallback como "free" com limites de 20 leads e 3 análises de IA.
- **Solução:** Criar uma RPC SQL `get_user_id_by_email` no banco de dados para buscar o ID do usuário de forma indexada e rápida no schema `auth.users` diretamente no Postgres. Ajustar as Edge Functions para utilizarem essa RPC.

### 7. Erro de Tipo no Frontend ao Consultar RPC de Assinatura (08/06/2026)
- **Análise:** Mesmo após a ativação Pro das assinaturas no banco de dados, o visual em produção para contas pagas persistia como Free (20 leads / 3 análises). O console revelou dois erros críticos de tipo:
  - `TypeError: F.rpc(...).catch is not a function` (em `useUsage.ts`)
  - `TypeError: m.rpc(...).catch is not a function` (em `useSubscription.ts`)
- **Causa Raiz:** O cliente JavaScript do Supabase (`supabase.rpc()`) retorna um objeto do tipo `PostgrestFilterBuilder` que implementa `PromiseLike` (possui o método `.then`), mas não possui o método `.catch` diretamente no builder. A tentativa de encadear `.catch(...)` direto na chamada da RPC lançou um erro de tipo síncrono/assíncrono no JavaScript que derrubou o `Promise.all` em ambas as hooks.
- **Consequência:** Como o `Promise.all` quebrou devido ao erro de tipo, o código do hook caía silenciosamente no bloco `catch` principal do React e forçava o estado do usuário de volta para o plano padrão `free` (20/3) para todas as contas que não possuíam bypass de admin (admins têm bypass síncrono no início do hook, o que explica por que a conta admin do desenvolvedor funcionava).
- **Resolução:** Substituímos o encadeamento direto de `.catch` nas RPCs por uma IIFE assíncrona segura (`(async () => { try { return await supabase.rpc(...); } catch (err) { ... } })()`) em ambos os hooks. O deploy da correção foi efetuado em Produção na Vercel e o site já está funcionando 100% com os limites Pro corretos.
### 8. Análise de Erro de Mensageria e Deploy da Edge Function IA (08/06/2026)
- **Mensagem do Console:** `Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`.
- **Diagnóstico:** Este erro é gerado por extensões de terceiros do Google Chrome (como LastPass, adblockers ou tradutores) que interceptam e falham ao responder chamadas assíncronas internas do navegador. Não há impacto ou relação com as requisições HTTP do Supabase, sendo um erro de falso positivo.
- **Causa da Copy Não Melhorar:** A Edge Function `analisar-lead-ia` em produção estava executando a lógica antiga e desatualizada da nuvem, que aplicava fallbacks de qualidade rígidos e genéricos (sobrescrevendo o plano do Gemini por textos fixos). As melhorias de prompt e novos prompts de copies de alta conversão presentes no Git local nunca haviam sido deployados na Edge Function correspondente na nuvem do Supabase.
- **Resolução:** Realizado o deploy da versão atualizada da Edge Function `analisar-lead-ia` contendo as melhorias de prompts de copy de 7 dias, contextualização por nicho e cidade de lead, e sanitização para os webhooks e prospecção de WhatsApp.
### 9. Causa Raiz do Erro CORS "Access-Control-Allow-Origin" (08/06/2026)
- **Problema Relatado:** Ao chamar "Refinar com IA" no frontend, o console do navegador lançava um erro CORS `No 'Access-Control-Allow-Origin' header is present on the requested resource` e a requisição falhava.
- **Causa Raiz:** A variável `leadData` estava declarada localmente dentro do escopo do bloco `try` (`let leadData: LeadData;` na linha 1266). No entanto, o bloco `catch` global (linha 1545) tentava ler `leadData` e suas propriedades para construir os logs de auditoria e resposta de erro (linhas 1570 a 1609). Como `leadData` não estava definida no escopo do `catch` ( ReferenceError), qualquer erro gerado antes de `leadData` ser inicializada (ou qualquer outra falha que caísse no catch) causava uma quebra síncrona do próprio bloco de tratamento de erro (`ReferenceError: leadData is not defined`). Isso derrubava a resposta HTTP formatada e fazia o Supabase Runtime retornar um status 500 genérico gerado pelo Kong (Gateway), o qual omitia os headers CORS.
- **Resolução:** Movi a declaração de `leadData` para a raiz da função `serve` (`let leadData: LeadData | null = null;`) e removi a declaração local `let` do bloco `try`. Com isso, qualquer exceção cai no `catch` e retorna com sucesso o JSON formatado 500 com os cabeçalhos CORS (`Access-Control-Allow-Origin: *`) anexados.

### 10. Falso Positivo de "Análises de IA não disponíveis" por Substrings (08/06/2026)
- **Descoberta:** Identificamos que a mensagem de erro genérica do catch na Edge Function (`Não conseguimos concluir a análise agora. Seu crédito de IA não foi consumido.`) continha a palavra `"crédito"`. No frontend, a heurística de detecção de saldo (`isBalanceError`) utilizava `.includes("crédito")` para deduzir se o erro era por falta de saldo. Com isso, qualquer erro técnico ou de API na Edge Function (como o rate limit do Gemini) que retornava a mensagem genérica era incorretamente interpretado pelo frontend como "Você não tem análises IA disponíveis", exibindo o Toast e bloqueando o fluxo de forma incorreta para admins e usuários Pro.
- **Erro Real Identificado nos Logs:** Ao consultar os eventos da tabela `app_events` para `ai_analysis_failed` no banco remoto, localizamos o debug real da falha: `"Rate limit excedido após 3 tentativas"`. Isso comprova que a chave do Gemini do usuário bateu no limite de taxa da API (429), mas o frontend mascarou o problema exibindo erro de créditos devido ao falso positivo da substring.
- **Resolução:**
  1. Alteramos `isBalanceError` nos 3 arquivos React do frontend (`LeadsList.tsx`, `LeadPlanDialog.tsx` e `LeadsSalvos.tsx`) para usar chaves de erro estruturadas (`error_code === "AI_CREDITS_EXHAUSTED"`, `error_code === "AI_LIMIT_REACHED"`, etc.) e substrings altamente específicas (ex: `"limite de análises atingido"`), removendo o check genérico de `"crédito"`.
  2. Alteramos a mensagem de erro padrão na Edge Function de `"Seu crédito de IA não foi consumido"` para `"O uso de IA não foi descontado"`, blindando também contra caches antigos do navegador.

### 11. Descontinuação do Modelo Gemini 2.0 Flash e Erro 404 (08/06/2026)
- **Descoberta:** Ao analisar as falhas recentes no banco de dados pós-deploy da iteração anterior, identificamos o erro real: `Gemini API error: 404`. Investigando as mudanças da Google no Google AI Studio, descobrimos que a Google **descontinuou e desligou oficialmente o modelo `gemini-2.0-flash` no dia 1º de junho de 2026**. Como a nossa Edge Function apontava para a URL antiga desse modelo, a API da Google passou a responder com status 404 (Not Found) para todas as requisições de análise de lead.
- **Resolução:** 
  1. Implementamos uma **cascata de modelos em loop de fallback** no backend (`analyzeWithGeminiDirect` na Edge Function `analisar-lead-ia/index.ts`). A função agora tenta analisar usando os seguintes modelos em ordem de prioridade: `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-1.5-flash` e por fim o legado `gemini-2.0-flash`.
  2. Se a API da Google retornar status `404` para o modelo atual, a Edge Function registra o aviso, intercepta o erro de forma limpa e passa automaticamente para o próximo modelo da lista de forma síncrona na mesma requisição. Isso blinda o sistema contra futuras descontinuações de modelos por parte da Google.
  3. Deploy da Edge Function atualizada efetuado no Supabase e alterações de backend commitadas e enviadas ao GitHub.

### 12. Colisão de Palavra-Chave no Foco (Serviços Profissionais)
- **Descoberta:** O foco `"servicos_profissionais"` contém a palavra `"serv"`. A Edge Function `analisar-lead-ia` possuía uma condicional que verificava `normalizedFocus.includes("serv")` para aplicar fallbacks e prompts de "Full Service" (assessoria digital). Se essa condicional não for reorganizada, a busca sob a nova categoria Serviços Profissionais incorretamente trará ganchos de agência de marketing digital, violando a regra principal de não tratar como marketing digital.
- **Resolução:** A verificação por `"servicos_profissionais"` (ou `"servicos profissionais"`) deve ser feita com precedência e estar no topo da função de inferência de contexto no backend (`getInferredContext`).
