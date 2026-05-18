# Planejamento da Tarefa: Otimização da Landing Page

## Fases
1. **Descoberta:** Identificar o componente principal da Landing Page (`LandingProspeccaoIA.tsx` ou equivalente) e seus subcomponentes.
2. **Reestruturação e Corte:**
   - Atualizar o `Hero` com copy direta.
   - Criar ou refinar seções `Como funciona`, `Para quem é`, `O que o Zuno faz`.
   - Remover seções longas e repetitivas (Encontre quem abordar, Saiba o que falar, Organize o acompanhamento, Priorize oportunidades, Transforme leads em rotina).
   - Remover os depoimentos fictícios (Social Proof falsa).
3. **Revisão das Seções Auxiliares:**
   - Garantir que os `Planos` estejam intactos.
   - Garantir que a seção `Indicação` seja clara e curta.
   - Refinar o `FAQ`.
   - Ajustar o `CTA final`.
4. **Verificação de Eventos e Rastreamento:** Certificar-se de que os eventos de clique, view e scroll continuam funcionando sem quebras por causa das seções removidas.
5. **Testes e Build:** Realizar `npm run build` para garantir que as alterações não introduziram erros.

## Checklists
- [ ] Ler e mapear `LandingProspeccaoIA.tsx`.
- [ ] Refatorar Hero.
- [ ] Compactar funcionalidades em "O que o Zuno faz por você".
- [ ] Remover Testimonials/Depoimentos Falsos.
- [ ] Revisar Planos, FAQ, Indicação, e CTA Final.
- [ ] Validar tracking e build.
