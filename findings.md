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

---

## 🛠️ Restrições de Produção

- **Preservação de Faturamento:** Nenhuma regra de preços, planos Stripe ou webhooks existentes deve ser modificada.
- **Bypass de Admin:** O e-mail de admin principal (`jeferson.zanotell@gmail.com`) deve possuir bypass imediato de limites e acesso ilimitado.
