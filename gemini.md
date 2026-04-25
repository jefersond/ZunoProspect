# Gemini (Constituição do Projeto - Reach-gen)

## Esquemas de Dados (Schemas)

### Sistema de Indicação (Referral Loop)
- **Tabela `profiles` (Supabase)**
  - `referral_code` (string, unique): Código único gerado para cada usuário (ex: `ref_98a7bx`).
  - `referred_by` (uuid, opcional): ID do usuário que indicou esta nova conta.
  - `saldo_buscas` (integer, default 0): Saldo atual de buscas do usuário.

### Fluxo de Indicação (Backend/Frontend)
1. **Frontend (`Auth.tsx`)**: Se a URL contiver `?ref=CODE`, passará `CODE` no `user_metadata` durante o `signUp`.
2. **Backend (Database Trigger)**: Ao inserir em `profiles` (ou `auth.users`), se houver `referred_by_code`, a trigger localiza o usuário dono do código, seta o `referred_by` e faz `UPDATE profiles SET saldo_buscas = saldo_buscas + 100 WHERE id = dono_do_codigo`.

## Regras Comportamentais
- V.L.A.E.G Protocol ativo.
- Foco em estabilidade e determinismo das camadas.
- "Dados Primeiro": Lógica de programação inicia apenas com esquema de dados confirmado.

## Invariantes Arquiteturais
- **Camada 1: Arquitetura (`architecture/`)** - Documentação e POPs.
- **Camada 2: Navegação** - LLM toma decisões estruturadas.
- **Camada 3: Ferramentas (`tools/`)** - Scripts Python e funções atômicas determinísticas.
