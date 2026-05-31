# Descobertas e Restrições Técnicas — Estabilização do Painel ADM

Este arquivo centraliza o mapeamento de vulnerabilidades, restrições arquiteturais e hipóteses de falhas para a área administrativa do Zuno Propect.

---

## 🔍 Mapeamento Técnico de Falhas e Hipóteses

### 1. Diagnóstico do Build Estático vs Runtime (O Bug do useCallback)
- **Descoberta:** O comando `npm run build` anterior passou com sucesso porque o Esbuild e o empacotador não lançaram erro de compilação com o hook `useCallback` não importado em `AdminRealtime.tsx` e `AdminAbandonedCheckouts.tsx`. Porém, no navegador, a sua falta gerou a exceção síncrona `ReferenceError: useCallback is not defined` no mount dos componentes, disparando o ErrorBoundary.
- **Correção:** Importamos explicitamente `useCallback` de `react` em todos os locais identificados no Painel ADM.

### 2. Incompatibilidade de Deno no Navegador
- **Descoberta:** No arquivo `src/pages/AdminSystemHealth.tsx`, havia uma chamada de verificação ao webhook utilizando `Deno.env.get("SUPABASE_URL")`. Como `Deno` é um runtime de servidor e não existe no navegador do usuário, a instrução gerou `ReferenceError: Deno is not defined` no runtime do React, travando as execuções de checagem.
- **Correção:** Removemos o uso de `Deno` e configuramos fallbacks baseados em variáveis do Vite e na URL hardcoded de produção.

### 3. Falta de timeouts em Promises no Supabase (Loading Infinito)
- **Descoberta:** Se a conexão com o banco de dados do Supabase ou a RPC `is_admin` ficasse lenta, offline ou a promise não resolvesse (por instabilidades de rede), as páginas `/admin/email` e `/admin/system-health` permaneciam presas em loading infinito porque seus loaders do mount inicial dependiam da resolução destas promises.
- **Correção:** Desenvolvemos um utilitário de controle de concorrência com limite de tempo, o `withTimeout`, que aborta chamadas assíncronas após 5 ou 6 segundos caso elas não respondam. Isso desliga o estado `loading` síncronamente e exibe um erro descritivo de timeout com botão de Retry.

### 4. Generics no TypeScript compatíveis com JSX
- **Descoberta:** Declarar a assinatura de generic simples `<T>` em arquivos `.tsx` induz o compilador JSX/Esbuild a pensar que se trata de uma tag HTML/React sem fechamento, gerando quebras de compilação.
- **Correção:** Declaramos os generics de forma segura usando `<T extends unknown>`, o que desfaz a ambiguidade com tags JSX e permite o build rodar com 100% de sucesso.

---

## 🛠️ Restrições de Produção

- **Preservação de Dados:** Migrações e scripts jamais devem truncar ou excluir tabelas em produção.
- **Preservação de Faturamento:** Nenhuma regra de preços, assinaturas ou integrações existentes com o Stripe deve ser modificada.
