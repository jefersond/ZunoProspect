# Painel de análise · prévias e verificação de layout

Imagens geradas renderizando o **`LeadPlanDialog` real** em Chromium (Playwright), tema escuro, com somente a rede e a assinatura substituídas por stubs. Empresas e textos são os dados de teste do repositório (fictícios). "Antes" = `main` (`163afbd`); "depois" = esta branch.

| Imagem | O que mostra |
|---|---|
| `desktop-antes.png` / `desktop-depois.png` | Análise completa, 1280 px |
| `desktop-depois-dados-incompletos.png` | Sem telefone, site nem avaliações: tudo "Indisponível", nada preenchido |
| `desktop-depois-analise-antiga.png` | Análise antiga (probabilidade legada, foco nulo) |
| `mobile-antes.png` / `mobile-depois.png` | 390 px |
| `mobile-depois-dados-incompletos.png` | 390 px, dados incompletos |
| `confirmacao-atualizar-copias-*.png` | Confirmação obrigatória do botão "Atualizar Cópias" |

## Verificação automática de layout (medida no navegador)

Para cada cenário: rolagem horizontal da página e do diálogo, elementos fora das bordas do diálogo, sobreposição entre botões e linhas de texto reais, e texto cortado.

| Versão | Tela | Estado | Resultado (Chromium real) |
|---|---|---|---|
| antes | desktop (1280 px) | complete | 2 sobreposições botão×texto: Refinar com IA × Alinhamento Cadastral para A / Refinar com IA × Critérios observáveis em dad |
| antes | desktop (1280 px) | incomplete | 2 sobreposições botão×texto: Refinar com IA × Alinhamento Cadastral para A / Refinar com IA × Critérios observáveis em dad |
| antes | desktop (1280 px) | legacy | 2 sobreposições botão×texto: Refinar com IA × Alinhamento Cadastral para A / Refinar com IA × Critérios observáveis em dad |
| antes | mobile (390 px) | complete | rolagem horizontal no diálogo (530 > 378); 7 elementos fora das bordas do diálogo |
| antes | mobile (390 px) | incomplete | rolagem horizontal no diálogo (530 > 378); 7 elementos fora das bordas do diálogo |
| antes | mobile (390 px) | legacy | rolagem horizontal no diálogo (530 > 378); 7 elementos fora das bordas do diálogo |
| depois | desktop (1280 px) | complete | sem sobreposição, sem texto cortado, sem rolagem horizontal |
| depois | desktop (1280 px) | incomplete | sem sobreposição, sem texto cortado, sem rolagem horizontal |
| depois | desktop (1280 px) | legacy | sem sobreposição, sem texto cortado, sem rolagem horizontal |
| depois | mobile (390 px) | complete | sem sobreposição, sem texto cortado, sem rolagem horizontal |
| depois | mobile (390 px) | incomplete | sem sobreposição, sem texto cortado, sem rolagem horizontal |
| depois | mobile (390 px) | legacy | sem sobreposição, sem texto cortado, sem rolagem horizontal |

Nos dois "antes" de desktop, o botão "Refinar com IA" sobrepõe o texto "Alinhamento Cadastral para Abordagem", como no print original. No celular, o diálogo rola para o lado (530 px de conteúdo em 378 px). Nenhum desses problemas existe no "depois".
