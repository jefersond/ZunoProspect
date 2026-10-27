# Integração seletiva do prompt v6 (a partir da main com #61, #63 e #64)

Branch `claude/integracao-prompt-v6`, sem publicação. Não contém a Edge Function antiga do PR #60.

## O que entrou
- Perfil comercial do assinante (`src/lib/sellerProfile.ts`, formulário em `SellerProfileDialog`): nome, empresa, serviço, descrição concreta e público. Sem perfil completo, a tela pede o preenchimento **antes** de qualquer chamada e a função responde 422 `REFINE_PROFILE_REQUIRED` sem Gemini e sem crédito.
- Prompt v6, schema e validador de qualidade (`_shared/lead-analysis.ts`): fatos verificados, primeiro contato com serviço + uma pergunta final, sem placeholders, sem objeções genéricas, sem afirmar necessidade/ausência/qualidade não medidas, no máximo uma mensagem para quem já respondeu, plano de ligação aceito para telefone fixo.
- Plano de 7 dias com `tipo_dia` (`mensagem`, `acompanhamento`, `tarefa`, `sem_mensagem`), `condicao` e `justificativa`; dias sem texto não abrem o SDR.
- Histórico das análises (até 3 versões) em `plano_prospeccao.history`.
- Telemetria de tokens por análise no log da função (`provider_summary`).

## O que foi mantido (nada removido)
Painel do #61 e opt-out em botões e handlers; sinalização e persistência confirmada do #63; reserva do lead, releitura antes de gravar, compare-and-set, preservação de edições e de etapas concluídas e cobrança só após gravação do #64; inspeção de HTML desativada; formato de requisição ao Gemini igual ao de produção (sem `thinkingConfig`, 7000 tokens, 18 s, ordem de modelos).

## Limitações documentadas
- O perfil fica no navegador (`localStorage`, isolado por usuário): não acompanha o assinante entre dispositivos. A tabela `seller_profiles` está só proposta em `docs/proposals/seller-profiles.sql` (não aplicada).
- O prompt v6 não produz nota de fechamento: `probabilidade_conversao` passa a ser gravada como `null` e a lista mostra "Análise pronta" em vez de uma porcentagem inventada (a antiga porcentagem 85 por padrão foi removida).
- Risco residual de concorrência (releitura final → UPDATE) só se elimina com `plan_revision` (migration não executada).
- Modelo principal: `gemini-3.6-flash` estourava 18 s na v91; ordem e prazo NÃO foram alterados aqui. Decidir após amostras reais.
