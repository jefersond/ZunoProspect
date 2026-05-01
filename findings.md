# Findings - Zuno Prospect

## Descobertas Técnicas
- **Erro 404 no Vercel**: Ocorrendo na rota `/auth`. Confirmado que é um erro de roteamento de SPA (Single Page Application). O Vercel não possui um `vercel.json` configurado para redirecionar todas as requisições para o `index.html`.
- **Estrutura de Rotas**: O `src/App.tsx` define `/auth` e `/auth/callback`, mas o servidor Vercel tenta buscar arquivos físicos para esses caminhos.
- **Supabase Auth**: O fluxo de autenticação redireciona para `/auth#access_token=...`, o que dispara o 404 se o roteamento do servidor não estiver configurado.

## Restrições
- O projeto deve seguir o protocolo V.L.A.E.G.
- Todas as rotas do frontend devem ser servidas pelo `index.html`.

## Dependências Relevantes
- `react-router-dom`: v6.30.1
- `@supabase/supabase-js`: v2.83.0
