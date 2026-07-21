# Zuno Marketing OS

## Objetivo do piloto

Criar uma operacao de marketing interna que continue produzindo entregas enquanto o administrador esta fora, mas mantenha aprovacao humana antes de qualquer gasto, publicacao ou contato externo.

O primeiro piloto deixa a midia paga pausada, com teto de R$ 0. Se o administrador decidir testar anuncios no futuro, ele define um novo teto exclusivamente para compra de midia, como Meta Ads. Esse teto sera um limite de seguranca, nao uma meta de gasto.

O teto nao limita o trabalho dos agentes, criacao de copy, design, conteudo organico, prospeccao, SDR, closer ou uso das ferramentas da Zuno. Quando a midia paga for liberada, a estrategia deve privilegiar uma campanha, um publico inicial, poucos criativos e aprendizado verificavel.

## Time e handoffs

1. Diretor de Marketing: transforma o objetivo em uma campanha e distribui os handoffs.
2. Gestor de Trafego: desenha objetivo, publico, estrutura, verba, testes e regras de pausa.
3. Copywriter: cria estrategia de mensagem, anuncios e copy de pagina.
4. Diretor de Arte: converte estrategia e copy em briefings e prompts de criativos.
5. Social Media: cria a semana de Instagram e entrega os posts estruturados.
6. SDR: define ICP, filtros, qualificacao e cadencia de prospeccao.
7. Closer: prepara diagnostico, demo, objecoes e follow-up.
8. Analista de Performance: define eventos, painel minimo e regras de decisao.

Cada especialista recebe a campanha e as entregas anteriores. A saida e salva em `marketing_tasks`; cada execucao e auditada em `marketing_agent_runs`.

## Fluxo operacional

```text
Administrador cria campanha
        |
        v
Diretor -> Trafego -> Copy -> Arte -> Social -> SDR -> Closer -> Performance
        |
        v
Campanha aguarda aprovacao
        |
        +-- Social aprovado -> fila existente do Instagram
        +-- Meta Ads -> aguarda conexao oficial da conta de anuncios
        +-- WhatsApp -> aguarda API oficial e politica de consentimento
```

O navegador pode chamar todos os agentes em sequencia. Para continuar a fila com o computador desligado, um cron pode chamar `marketing-orchestrator` com a acao `run_next`; cada chamada processa apenas uma tarefa, reduzindo risco de timeout e permitindo retomada.

## Estados e seguranca

- Campanha: `planning`, `generating`, `pending_approval`, `approved`, `active`, `paused`, `completed` ou `failed`.
- Tarefa: `queued`, `running`, `pending_approval`, `approved`, `rejected`, `completed` ou `failed`.
- Apenas administradores acessam as tabelas e a tela `/admin/marketing`.
- A Edge Function valida novamente o administrador.
- O cron so pode executar `run_next` e exige `MARKETING_CRON_SECRET`.
- A verba solicitada nao pode ultrapassar `marketing_settings.monthly_paid_media_cap`.
- Trafego, copy, criativos, posts, SDR e closer aguardam aprovacao.
- Aprovar uma entrega nao gasta verba e nao envia mensagem.
- O SDR nao deve simular comportamento humano, fazer disparo em massa ou tentar contornar bloqueios.
- Nenhum agente pode inventar clientes, numeros, depoimentos, funcionalidades ou resultado esperado.

## O que esta funcional no MVP

- Central administrativa para criar e acompanhar campanhas.
- Oito agentes com responsabilidades e saidas separadas.
- Execucao passo a passo, retomada e repeticao de tarefa com erro.
- Limites globais e por campanha.
- Aprovacao por entrega ou da campanha completa.
- Envio dos posts aprovados para `instagram_content_posts`.
- Rastreamento de entradas, saidas, modelo, erro e horario de cada execucao.
- Endpoint seguro para consumo da fila por cron.

## Conexoes externas ainda necessarias

### Meta Ads

Para criar ou ativar campanhas reais, conectar uma conta de anuncios pela Meta Marketing API. A primeira versao deve criar campanha pausada, validar pixel/eventos e pedir uma ultima aprovacao antes de ativar. Nao armazenar token no navegador ou nas tabelas publicas.

### Design final

O Diretor de Arte entrega conceito, composicao, texto de arte e prompt. A geracao/renderizacao da imagem final exige um provedor de imagem e armazenamento publico. Ate essa conexao existir, a arte continua sendo um briefing de producao.

### WhatsApp

Usar somente WhatsApp Business Platform/API oficial, templates quando exigidos e politica de opt-in aplicavel. O piloto deve manter aprovacao por conversa/lote pequeno e registrar opt-out. Nao usar atrasos aleatorios como tecnica para evitar banimento.

## Publicacao tecnica

1. Aplicar `supabase/migrations/20260720223000_marketing_operations_team.sql`.
2. Fazer deploy de `marketing-orchestrator` com verificacao de JWT.
3. Confirmar a secret de IA ja usada na Zuno (`GOOGLE_GEMINI_API_KEY`, `GEMINI_API_KEY` ou `Gemini_API`).
4. Opcionalmente definir `MARKETING_TEAM_MODEL`; o padrao e `gemini-2.5-flash`.
5. Definir `MARKETING_CRON_SECRET` com valor aleatorio forte.
6. Publicar o frontend e validar `/admin/marketing` com uma conta administradora.

Para o trabalho em segundo plano, configurar um cron a cada cinco minutos que envie:

- `Authorization: Bearer <anon key>`
- `apikey: <anon key>`
- `x-cron-secret: <MARKETING_CRON_SECRET>`
- JSON: `{ "action": "run_next" }`

Sem o cron, o botao `Criar campanha e acionar time` continua executando o time enquanto a pagina estiver aberta. A opcao de planejamento diario as 7h30 fica desligada durante o piloto e so deve ser ativada depois que dados, canais e relatorios estiverem conectados.

## Criterio para liberar automacao

O piloto so avanca de ADM para execucao automatica depois de:

- uma campanha completa revisada pelo administrador;
- copies e criativos sem afirmacoes nao comprovadas;
- evento de conversao validado;
- conta de anuncios e limites de gasto testados com campanha pausada;
- Instagram profissional e publicador testados;
- WhatsApp oficial, consentimento e opt-out testados;
- regra clara para pausar quando os dados forem insuficientes ou ruins.
