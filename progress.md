# Registro de Progresso — IA & Atribuição de Origem

Este arquivo acompanha as iterações, erros analisados, correções efetuadas e resultados de homologação para blindagem da IA e correção da atribuição multitoque no Zuno Propect.

---

## 🚀 Estado Atual (02/06/2026)

- **Fase de Planejamento:** Identificadas falhas críticas relatadas por usuários pagos vindo de campanhas Meta Ads que não conseguem rodar análises de IA consecutivas.
- **Mapeamento Concluído:**
  - Lógica de IA e controle de concorrência em `LeadsList.tsx`.
  - Atribuição multitoque no profile e inferência de eventos em `AdminRealtime.tsx`.
  - Tratamento de CORS, OPTIONS e erros na Edge Function `analisar-lead-ia`.
  - Mapeamento de criativos de campanhas Meta Ads em `creativeMap.ts`.

---

## 📈 Histórico de Atividades e Iterações

### Iteração 1: Inicialização do Protocolo V.L.A.E.G. (Modo Planejamento)
- [x] Criação do plano de implementação premium `implementation_plan.md` no diretório de artefatos.
- [x] Atualização da Constituição do Projeto em `gemini.md` no workspace.
- [x] Criação e atualização de `task_plan.md`, `findings.md` e `progress.md` no workspace de trabalho.
- [ ] Obter respostas de descoberta e aprovação do Blueprint pelo usuário.

---

## 📊 Acompanhamento Técnico de Bugs (IA & Atribuição)

| Bug Relatado | Causa Provável | Ação Efetuada | Status |
| :--- | :--- | :--- | :--- |
| **1. Falhas críticas de IA para usuários pagos** | Instabilidades na API do Gemini ou cota da chave esgotada, gerando erros não tratados. | Blindar Edge Function, retornar JSON estruturado rico e tratar no frontend com erros amigáveis. | ⏳ Planejado |
| **2. Atribuição First/Last Touch vazia** | Falhas na sincronização do profile via localStorage ou navegação anônima sem UTMs salvas. | Implementar inferência de UTMs baseada no histórico de eventos (`app_events`) na tela do admin. | ⏳ Planejado |
| **3. Cliques duplicados consumindo cota** | Cliques repetidos rápidos chamando a Edge Function simultaneamente. | Adicionar desabilitação e controle síncrono por `lead_id` no frontend. | ⏳ Planejado |
| **4. ID numérico de criativo no admin** | Criativos do Meta Ads aparecendo como IDs brutos sem mapeamento legível. | Adicionar o ID `120248028635250725` no `CREATIVE_NAME_MAP`. | ⏳ Planejado |
