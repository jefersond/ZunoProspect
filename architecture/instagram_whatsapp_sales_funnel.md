# Funil Instagram, WhatsApp e site da Zuno

## Decisão de produto

A jornada comercial padrão não usa reunião, chamada ou agenda.

Instagram gera interesse. A pessoa inicia uma interação permitida. A Zuno transfere a conversa para o WhatsApp. SDR e closer trabalham no mesmo chat. O site aparece somente para cadastro, teste ou pagamento. Depois da conversão, o onboarding volta ao WhatsApp.

## Jornada

1. A Zuno publica conteúdo orgânico com um CTA claro.
2. A pessoa envia DM, responde um Story, menciona a conta, comenta em um conteúdo compatível ou usa o link da bio.
3. O webhook do Instagram registra a origem, campanha, conteúdo e mensagem.
4. O agente responde apenas dentro das possibilidades oficiais e faz uma pergunta curta de contexto.
5. Quando houver interesse, envia o link oficial do WhatsApp com mensagem predefinida e código de origem.
6. A pessoa clica e precisa enviar a primeira mensagem no WhatsApp.
7. O webhook do WhatsApp registra a entrada, consentimento, horário e janela de atendimento.
8. O SDR qualifica sem reunião: perfil, objetivo, volume de prospecção, dificuldade e urgência real.
9. O closer demonstra a Zuno com texto, imagem, vídeo curto ou link, responde objeções e recomenda um plano.
10. O closer envia o link do site com atribuição para cadastro ou pagamento.
11. O webhook de cadastro ou pagamento marca a conversão e inicia o onboarding no WhatsApp.
12. A qualquer momento, a pessoa pode pedir para parar ou falar com Jeferson no mesmo chat.

## Limites oficiais

A API oficial do Instagram não deve ser usada para enviar DM fria automática a perfis arbitrários. A conversa automatizada começa depois de uma ação da pessoa. Uma resposta privada a comentário é possível quando o evento e a janela permitirem, mas essa função exige webhook, permissões e revisão do app.

O link do WhatsApp abre o chat e pode preencher uma mensagem, mas não envia automaticamente. A pessoa precisa tocar em enviar. Isso cria uma entrada iniciada pelo usuário e uma evidência clara da origem.

No WhatsApp, a Zuno só contata quem forneceu o número e autorizou mensagens. Dentro de 24 horas da última mensagem do usuário, a automação pode responder sem template. Fora da janela, apenas template aprovado e compatível com o consentimento.

A automação se identifica como assistente da Zuno. Não finge ser Jeferson e não usa atrasos para parecer humana. Deve existir um caminho claro para atendimento humano; o padrão é continuar no mesmo WhatsApp com Jeferson.

## Link de transferência

Número comercial atual: 55 32 9851-1685.

Formato planejado:

https://wa.me/553298511685?text=Oi%2C%20vim%20do%20Instagram%20e%20quero%20conhecer%20a%20Zuno.%20Origem%3A%20IG-CAMPANHA

Cada conteúdo recebe um código curto de origem. O webhook salva o código quando a primeira mensagem chegar.

## Link para o site

O closer envia um link de cadastro ou pagamento somente depois de recomendar o caminho adequado. O link deve carregar origem e campanha, por exemplo:

https://www.zunopropect.com.br/auth?tab=signup&utm_source=whatsapp&utm_medium=conversation&utm_campaign=instagram_organico

O evento de sucesso não é apenas clique. Medir cadastro concluído, primeira busca, plano escolhido e pagamento confirmado.

## Estados da conversa

- ig_inbound: a pessoa iniciou interação no Instagram.
- ig_qualifying: o agente está entendendo contexto.
- wa_link_sent: o link do WhatsApp foi enviado.
- wa_inbound: a pessoa enviou a primeira mensagem no WhatsApp.
- wa_qualifying: SDR coleta o mínimo necessário.
- wa_closer: conversa comercial e objeções.
- checkout_sent: link do site enviado.
- converted: cadastro ou pagamento confirmado.
- onboarding: primeiros passos pelo WhatsApp.
- human_handoff: Jeferson assume no mesmo chat.
- opted_out: automação e follow-ups interrompidos.
- closed_lost: oportunidade encerrada com motivo.

## Controles no ADM

A central deve mostrar canal, origem, estágio, última mensagem do usuário, fim da janela de 24 horas, consentimento, responsável, próxima ação, risco de política e histórico completo.

Modos previstos:

- aprovação: o agente prepara e Jeferson aprova o envio;
- automático seguro: responde somente eventos inbound e regras já aprovadas;
- humano: pausa a automação e entrega a conversa para Jeferson.

Nenhum modo permite DM fria automática no Instagram, mensagem de WhatsApp sem opt-in, reunião automática ou envio depois de opt-out.

## Integrações necessárias

Instagram:

- conta profissional;
- Meta App;
- token com permissões de mensagens e comentários aplicáveis;
- webhook HTTPS;
- App Review e Advanced Access quando exigidos;
- segredo de verificação e validação de assinatura.

WhatsApp:

- Meta Business Portfolio;
- WhatsApp Business Account;
- número comercial registrado;
- WhatsApp Cloud API;
- token de sistema;
- webhook HTTPS;
- templates aprovados para mensagens fora da janela.

Secrets previstas:

- META_APP_SECRET;
- META_WEBHOOK_VERIFY_TOKEN;
- INSTAGRAM_MESSAGING_ACCESS_TOKEN;
- INSTAGRAM_BUSINESS_ACCOUNT_ID;
- WHATSAPP_ACCESS_TOKEN;
- WHATSAPP_PHONE_NUMBER_ID;
- WHATSAPP_BUSINESS_ACCOUNT_ID;
- WHATSAPP_WEBHOOK_VERIFY_TOKEN.

## Fases

### Fase 1 — segura

Continuar publicando conteúdo com aprovação. Usar CTA para DM iniciada pela pessoa ou link da bio. Gerar os roteiros do SDR e closer sem envio automático.

### Fase 2 — Instagram inbound

Conectar webhooks de DM, menção e comentários. Testar respostas privadas e transferências para WhatsApp apenas com a conta administradora e perfis de teste.

### Fase 3 — WhatsApp oficial

Conectar a Cloud API, registrar inbound, janela de 24 horas, consentimento, opt-out e handoff humano. Testar com número de teste antes de registrar o número comercial.

### Fase 4 — fechamento e onboarding

Integrar cadastro e pagamento. Liberar recomendação de plano, link do site, confirmação de conversão e onboarding no WhatsApp.

### Fase 5 — automático seguro

Ativar somente após revisão de conversas reais, mensagens aprovadas, política validada, logs completos e botão de pausa no ADM.
