# Task Plan - Zuno Prospect: Escala, Viralidade e Redução de Custos

## Fases do Projeto e Objetivos Principais
- **Objetivo 1: Escalar Receita** (Refatoração da Landing Page)
- **Objetivo 2: Aumentar Viralidade** (Sistema de Indicação / Referral Loop)
- **Objetivo 3: Reduzir Custos** (Migração 100% para Gemini 2.0 Flash)

## Plano de Ação (Checklist)

### Fase 1: Auditoria e Corte de Custos (Migração para Gemini)
- [x] Realizar busca global por `openai`, `gpt` e `OPENAI_API_KEY`.
- [x] Identificar e substituir todas as chamadas de API da OpenAI em Edge Functions e componentes.
- [x] Garantir que 100% da geração de texto e inteligência ocorra via `@google/genai` (Gemini 2.0 Flash).
- [x] Remover SDKs e pacotes da OpenAI do `package.json` e Deno imports.

### Fase 2: Interface Premium & Conversão (Landing Page)
- [x] Atualizar o Hero Section focando na oferta "O Plano de Prospecção de 7 Dias".
- [x] Aplicar estilo **Glassmorphism** (fundos translúcidos, bordas finas com backdrop-blur).
- [x] Revisar paleta de cores para um design de alto padrão focado no mercado B2B.
- [x] Otimizar carregamento inicial de assets.

### Fase 3: Motor de Viralidade (Sistema de Indicação)
- [x] Modificar o Dashboard do Cliente (área logada).
- [x] Criar o componente de Indicação com a copy: "Indique o Zuno Prospect e ganhe 100 buscas adicionais".
- [x] Implementar a mecânica de "Copiar link de indicação" (Copiado para área de transferência com feedback visual).
- [x] Adicionar barra de progresso visual simulando as indicações.

### Fase 5: Infraestrutura e Roteamento
- [ ] Criar arquivo `vercel.json` na raiz do projeto `reach-gen`.
- [ ] Configurar regras de `rewrites` para suportar Single Page Application (SPA).
- [ ] Testar acesso direto à rota `/auth` e fluxos de autenticação.
