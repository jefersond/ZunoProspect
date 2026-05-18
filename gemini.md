# Constituição do Projeto - Zuno Prospect UTM Tracking

## Esquemas de Dados
- **Entrada (URL):** `utm_content` (string | id numérico do meta)
- **Saída (Painel):** 
  - `Criativo` (Nome amigável, ex: "quem_abordar")
  - `utm_content original` (Valor bruto, ex: "120246631612400725")

## Regras Comportamentais
- Nunca quebrar o painel se o UTM não for reconhecido.
- Mostrar "sem_utm_content" caso o valor seja vazio.
- Não apagar histórico.

## Invariantes Arquiteturais
- O mapa de criativos será mantido no frontend em `src/lib/creativeMap.ts` (ou similar).
- O backend salvará os dados brutos como antes (ou em uma coluna de histórico, se criarmos com segurança).
