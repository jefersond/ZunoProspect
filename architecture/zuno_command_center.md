# Central de comando Zuno

Data: 2026-07-21

## Objetivo

Dar ao fundador uma única tela para acionar o time de agentes da Zuno e encaminhar mudanças de programação ao Codex quando estiver no computador.

## Modos de operação

| Situação | Disponível | Limite |
| --- | --- | --- |
| PC desligado | Marketing OS, Instagram, campanhas, aprovações e dados hospedados no Supabase | Não acessa arquivos locais nem executa programação no computador |
| PC ligado com Codex | Tudo da nuvem mais abertura de um pedido no Codex ligado ao repositório GitHub da Zuno | A conversa ocorre no aplicativo Codex; o site não lê a resposta automaticamente |
| Sem internet | Trabalho local que não dependa de Supabase, Gemini ou APIs externas | A Central web e os agentes hospedados ficam indisponíveis |

## Processamento em segundo plano

Ao receber `run_campaign_async`, a Edge Function responde imediatamente e usa `EdgeRuntime.waitUntil` para executar uma tarefa. Cada etapa concluída chama internamente a próxima com a credencial de serviço, mantendo o processamento fora do navegador e salvando o estado no banco. A ação interna não aceita sessão comum e não fica disponível para o público.

## Integração com Codex

A primeira versão usa o deep link oficial `codex://threads/new` com `prompt` e `originUrl`. Isso abre uma nova tarefa no Codex e associa o repositório correto sem expor credenciais ou um servidor de execução na internet.

O `codex app-server` permite clientes de protocolo locais, mas está marcado como experimental. Uma futura ponte bidirecional deve rodar apenas no loopback, exigir token local e nunca expor execução do Codex em uma rota pública.

## Segurança

- A rota `/admin/central` permanece protegida por `AdminRoute`.
- A nuvem só chama a Edge Function autenticada `marketing-orchestrator`.
- Nenhuma mensagem externa, anúncio ou publicação é disparada pela Central sem passar pelos fluxos de aprovação existentes.
- Programação local é encaminhada ao Codex; o site hospedado não recebe acesso direto ao sistema de arquivos.

## Próximas evoluções

1. Fila persistente de pedidos gerais no Supabase.
2. Aplicativo auxiliar local com loopback e token para devolver status do Codex à Central.
3. Agendador de prospecção das 07:30 com fila, opt-in e limites de contato.
4. Caixa de entrada unificada Instagram e WhatsApp pelas APIs oficiais.
