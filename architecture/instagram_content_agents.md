# Agentes de conteúdo para Instagram

## Resultado implementado

A central administrativa /admin/instagram orquestra três agentes em sequência:

1. **Estrategista**: escolhe pilar, recorte de público, formato, gancho, ângulo e CTA sem repetir os temas recentes.
2. **Criador**: produz legenda, hashtags, briefing visual e, para carrosséis, o texto de 5 a 8 slides.
3. **Revisor**: remove clichês, promessas, dados inventados, agressividade e desalinhamentos de marca.

Cada etapa é registrada em agent_trace. O resultado entra em instagram_content_posts e segue a máquina de estados:

pending_review -> approved -> scheduled -> publishing -> published

Também existem os estados draft, rejected e failed.

## Papel no funil de vendas

Os posts de conversão devem gerar uma ação iniciada pelo usuário: DM, resposta a Story, comentário permitido ou link da bio. Depois do sinal de interesse, o contato recebe o link do WhatsApp e a venda continua ali, sem reunião.

O publicador de conteúdo não envia DMs. Mensagens, comentários privados e webhooks exigem uma integração separada da Instagram Messaging API.

Enquanto essa integração não estiver ativa, o agente não deve prometer resposta automática a comentário; o CTA seguro é pedir uma DM ou usar o link da bio.

## Segurança

- A tela e as tabelas são exclusivas para administradores.
- As duas Edge Functions exigem JWT.
- A função de geração valida novamente a permissão de administrador.
- O publicador exige administrador ou chamada de cron com INSTAGRAM_CRON_SECRET.
- Tokens da Meta ficam somente nos Secrets do Supabase.
- Nenhum post sem imagem pública é enviado à Meta.
- O modo padrão é approval.

## Secrets necessários

A geração usa a secret já existente Gemini_API.

Para publicar, configurar no projeto Supabase:

- INSTAGRAM_ACCESS_TOKEN: token da conta profissional com permissão de publicação.
- INSTAGRAM_BUSINESS_ACCOUNT_ID: ID da conta profissional.
- INSTAGRAM_CRON_SECRET: segredo aleatório usado somente pelo agendador.
- META_GRAPH_API_VERSION: opcional; o fallback atual é v25.0.

A conta precisa ser profissional (Business ou Creator). No fluxo com Facebook Login, normalmente ela deve estar vinculada a uma Página e o app precisa da permissão instagram_content_publish.

## Agendador

Depois de configurar as secrets da Meta, salve no Vault:

- instagram_project_url
- instagram_anon_key
- instagram_cron_secret

Então crie um Cron Job a cada cinco minutos, chamando a Edge Function instagram-publisher com:

- Authorization: Bearer <instagram_anon_key>
- apikey: <instagram_anon_key>
- x-cron-secret: <instagram_cron_secret>
- corpo JSON vazio

O publicador processa no máximo cinco posts vencidos por execução. Posts sem mídia são ignorados e permanecem agendados.

## Formatos

- **Post único**: uma URL HTTPS em media_urls.
- **Carrossel**: de duas a dez URLs HTTPS, uma por linha e na ordem dos slides.

A Meta busca as imagens pela URL, portanto elas precisam estar publicamente acessíveis durante a criação do container.

## Arquivos principais

- src/pages/AdminInstagram.tsx
- supabase/functions/instagram-content-agent/index.ts
- supabase/functions/instagram-publisher/index.ts
- supabase/migrations/20260720183000_instagram_content_agents.sql