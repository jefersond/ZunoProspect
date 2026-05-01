# Progress - Zuno Prospect

## ✅ Concluído

### Sprint 27/04/2026 - Correção 404 + Harmonização LP

**Problema 1: Erro 404 ao acessar o app**
- [x] Causa identificada: SPA sem `vercel.json` de roteamento.
- [x] Criado `vercel.json` com regra `rewrites` → todas as rotas servem `index.html`.
- [x] Após o próximo `git push`, o erro 404 será eliminado.

**Problema 2: LP com cores inconsistentes com o design system**
- [x] `HeroSection.tsx`: Removido tema dark hardcoded (`bg-zinc-900/40`, `text-white`, `text-zinc-400`, gradiente `teal/cyan`). Substituído por variáveis semânticas (`text-foreground`, `text-muted-foreground`, `bg-card/60`, `text-primary`).
- [x] `LPHeader.tsx`: Corrigidos botões `Entrar` e `Começar Grátis` — de `emerald-600` hardcoded para `bg-primary`.
- [x] `CTAFinalSection.tsx`: Corrigido botão principal de `emerald-600` para `bg-primary`.
- [x] `DepoimentosSection.tsx`: Corrigidas cores dos avatares — removidos `blue-500`, `purple-500`, `amber-500`. Substituídos por variações de `primary`.
- [x] `ParaQuemSection.tsx`: Corrigido `text-emerald-500` → `text-primary` nos ícones de checkmark.

## Próximos Passos
- [ ] Fazer `git add . && git commit && git push` para aplicar as correções no Vercel.
