# Planejamento da Tarefa: Painel Admin - Visão "Checkouts Abandonados" (Zuno Prospect)

## Fases do Projeto (V.L.A.E.G. Protocol)

### Fase 1: Descoberta e Visão (V.L.A.E.G.)
- [x] Analisar a base de código do checkout (`Checkout.tsx`), roteamento (`App.tsx`), e painéis administrativos existentes (`AdminRealtime.tsx`, `AdminEmail.tsx`).
- [x] Atualizar a constituição do projeto `gemini.md` com os esquemas e regras comportamentais de faturamento e checkouts.
- [ ] Criar `implementation_plan.md` no diretório de artefatos e obter a aprovação explícita do usuário. (Criado em `/brain/.../implementation_plan.md`)

### Fase 2: Link e Conectividade
- [ ] Validar conexões com RPC de administração do Supabase e eventos da tabela `app_events`.
- [ ] Confirmar o recebimento dos eventos de checkout iniciados no ambiente de desenvolvimento local.

### Fase 3: Desenvolvimento Arquitetural (Implementação)

#### 1. Enriquecimento de Metadados do Checkout (`Checkout.tsx`)
- [ ] Importar o hook `useUsage` no componente de Checkout.
- [ ] Atualizar o fluxo de finalização para registrar o evento `"InitiateCheckout"` na tabela `app_events` com metadados detalhados de limites de IA, buscas, leads, plano prévio, valor do plano e sessão do Stripe.
- [ ] Enriquecer também os eventos existentes `"checkout_started"` / `"Checkout_Started"` com a mesma robustez de dados.

#### 2. Configuração de Rota Protegida (`App.tsx`)
- [ ] Adicionar o lazy loading do novo componente `AdminAbandonedCheckouts`.
- [ ] Declarar a rota protegida `/admin/checkouts-abandonados` no switch de rotas.

#### 3. Desenvolvimento do Componente de Checkouts Abandonados (`AdminAbandonedCheckouts.tsx`)
- [ ] Implementar autenticação de administrador com RPC `is_admin` e bypass para o e-mail administrativo principal `jeferson.zanotell@gmail.com`.
- [ ] Criar query flexível e otimizada na tabela `app_events` com filtros de tempo (últimas 24h, 7 dias, 30 dias) e exclusão de eventos de teste internos por padrão.
- [ ] Implementar a lógica de agregação por sessão/usuário e o algoritmo de identificação de checkouts abandonados (InitiateCheckout existe e não há Purchase posterior).
- [ ] Desenvolver a função `classifyCheckoutStatus` com classificação em `converted`, `checkout_failed`, `recent` e `abandoned`.
- [ ] Programar o motor de diagnósticos automáticos comportamentais (Alta intenção, Alta falha de IA antes, Fricção no Stripe, Starter, Pro, etc.) gerando badges dinâmicos.
- [ ] Codificar o motor de prioridades (*CRÍTICA*, *TÉCNICA*, *ALTA*, *NORMAL*) baseado no nível de intenção e problemas de suporte do lead.
- [ ] Desenvolver a interface visual premium (identidade oficial escura `#0b0f0e`, card `#111816`, bordas `#1f2d29`, verde neon `#10d98a` e tipografia Google Fonts).
- [ ] Renderizar os cards estatísticos de resumo e KPIs no topo da visão.
- [ ] Criar tabelas e gráficos auxiliares de comparação por Plano, Criativo/Campanha e auditoria específica de falhas de IA pré-checkout.
- [ ] Vincular o botão "Ver Jornada" à rota de timeline ativa em `/admin/realtime` passando query params apropriados.

#### 4. Conectividade entre Painéis Administrativos
- [ ] Atualizar `AdminRealtime.tsx` e `AdminEmail.tsx` com navegações/links integrados de fácil acesso para a nova tela.

### Fase 4: Estilo (Refinamento Premium e UI/UX)
- [ ] Assegurar transições suaves, polimento com animações de hover e badges HSL coloridos de prioridade/diagnóstico na tabela admin.
- [ ] Garantir responsividade móvel de todos os cards de resumo e tabelas comparativas.

### Fase 5: Gatilho e Homologação
- [ ] Executar o comando `npm run build` no terminal para verificar a tipagem e compilação do TypeScript.
- [ ] Resumir as entregas no walkthrough de progresso e detalhar os cenários testados manualmente.
