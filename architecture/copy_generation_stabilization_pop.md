# Procedimento Operacional Padrão (POP) - Estabilização e Auditoria de Copies Zuno Propect

## 1. Objetivos
- Estabelecer um mapa de regras comportamentais estruturado por foco (`FOCUS_BEHAVIOR_MAP`).
- Enviar as regras e diretrizes correspondentes ao foco selecionado no prompt de IA (Gemini).
- Flexibilizar e tornar resiliente a validação de copies e pós-processamento, evitando quedas indevidas em fallback genérico.
- Garantir que cada lead possua seu próprio plano de prospecção detalhado de 7 dias, persistido no Supabase na tabela `leads` (coluna `plano_prospeccao` do tipo JSONB) e retornado na resposta HTTP.
- Dificultar a repetição de copies genéricas, forçando a diferenciação por foco (ex: "Social Media" foca em engajamento/DM/Instagram e "Full Service" foca em jornada digital integrada).

---

## 2. Estrutura de Entrada e Saída (Dados)

### Formato de Entrada para Análise (Payload HTTP)
A Edge Function `analisar-lead-ia` recebe do frontend um JSON contendo:
- `leadId`: uuid do lead no banco.
- `lead`: objeto contendo dados do lead (nome, nicho, cidade, site, sinais, foco).
- `search_context`: contexto da busca (cidade, nicho, foco, país, etc.).
- `analysis_context`: contexto de análise (tom desejado, canais).

### Formato do Campo `plano_prospeccao` (JSONB) no Banco de Dados
```json
{
  "cadence": {
    "day_1": {
      "objective": "Abertura contextual",
      "channel": "whatsapp",
      "action": "...",
      "angle": "...",
      "message": "...",
      "cta": "..."
    },
    ...
    "day_7": {
      "objective": "Encerramento elegante",
      "channel": "whatsapp",
      "action": "...",
      "angle": "...",
      "message": "...",
      "cta": "..."
    }
  },
  "likely_objection": "...",
  "objection_response": "...",
  "conversion_strategy": "...",
  "generated_at": "ISO_DATE",
  "version": "v2_personalized_cadence"
}
```

---

## 3. Lógica do Backend (Edge Function `analisar-lead-ia`)

### A. Mapa de Regras Comportamentais por Foco (`FOCUS_BEHAVIOR_MAP`)
Definir constantes contendo:
- `label`: Nome amigável.
- `commercial_goal`: Objetivo comercial.
- `diagnosis_lens`: O que analisar nos sinais.
- `likely_pains`: Dores prováveis.
- `approach_angles`: Ângulos de abordagem.
- `recommended_terms`: Termos recomendados.
- `avoid_terms`: Termos proibidos (geram erro na validação se usados).
- `cta_examples`: Exemplos de Call-To-Action.
- `likely_objections`: Objeções prováveis.
- `objection_responses`: Respostas sugeridas.
- `cadence_strategy`: Objetivos sugeridos por dia de 1 a 7.

### B. Montagem do Prompt
O prompt de IA (`systemPrompt` e `userPrompt`) é enriquecido com as regras do foco do lead atual, aplicando a instrução:
*"Use obrigatoriamente as regras comportamentais do foco selecionado. Não gere uma copy genérica. A copy precisa respeitar o objetivo, as dores, os ângulos, os termos recomendados e os termos proibidos desse foco."*

### C. Validação e Regeneração/Fallback
1. **Validação:** A copy gerada pela IA deve:
   - Respeitar o foco do lead.
   - Usar ou alinhar com pelo menos um ângulo do foco.
   - **Não** conter nenhum termo proibido listado em `avoid_terms`.
   - Evitar os termos excessivamente genéricos listados em `GENERIC_ANALYSIS_TERMS`.
   - Conter uma cadência válida de 7 dias com todos os campos obrigatórios.
2. **Queda em Fallback por Foco:** Se a validação falhar (ou a chamada de IA der erro completo), o sistema aplica o fallback individual e dinâmico customizado para o foco específico e o nicho/cidade do lead (usando templates de fallback que preenchem as variáveis com base no `FOCUS_BEHAVIOR_MAP`), e nunca um template universal único.

---

## 4. Lógica de Persistência no Supabase
- Salvar o payload JSON final estruturado diretamente no campo `plano_prospeccao` do lead na tabela `leads`.
- Retornar o JSON de resposta HTTP:
  ```json
  {
    "success": true,
    "lead_id": "...",
    "plano_prospeccao": { ... }
  }
  ```
