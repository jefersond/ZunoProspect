# Findings - Reach-gen

## Pesquisas e Descobertas
- **Build:** O aplicativo passa no build do Vite com sucesso.
- **TypeScript:** Nenhuma quebra de compilação. Tipagem base estável.
- **Linter:** Foram encontrados 163 problemas no ESLint, a maioria por uso do tipo `any`.
- **Arquitetura Base:** React 19 com Vite, Tailwind CSS e Shadcn UI.

## Análise de Custos e Viabilidade (Caixa Baixo)
- **Google Places API (`buscar-leads`):** O código faz chamadas pesadas (`Nearby Search`, paginação e `Place Details`). Cada busca pode custar até $1 a $2 dependendo do raio e leads encontrados.
- **Inteligência Artificial (`analisar-lead-ia`):** O código prioriza a **OpenAI (GPT-4o)**, que é cara para análises longas, fazendo fallback para o Gemini apenas se a OpenAI falhar.
- **Conclusão:** Vender o SaaS por um ticket baixo (ex: R$ 9,90) na arquitetura atual gerará **prejuízo imediato**. O custo de operação por usuário é maior que a receita.
