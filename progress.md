# Progresso

- Protocolo VLAEG iniciado para a separação de eventos reais e internos no painel de tracking.
- Criada migration SQL `20260518120000_internal_events_tracking.sql` adicionando os campos:
  - `is_internal_event boolean DEFAULT false`
  - `event_source_type text DEFAULT 'unknown'`
  - `user_email text`
- `src/lib/tracking.ts` atualizado para:
  - Detectar testes internos via URL (`?internal=true/false`), `sessionStorage`, `localStorage` ou domínios de dev/preview.
  - Classificar `event_source_type` (paid, organic, referral, direct, internal_test, unknown).
  - Incluir `jeferson.zanotell@gmail.com` na lista de e-mails forçados como `internal_test`.
- `src/lib/metaPixel.ts` atualizado para barrar eventos com `detectInternalEvent()` verdadeiro de chegarem ao `fbq`.
- `supabase/functions/track-event/index.ts` atualizado para receber os novos campos e reforçar a classificação de teste/admin se o token de Auth pertencer ao e-mail de admin, além de suportar os campos no insert para a tabela `app_events`.
- `src/pages/AdminRealtime.tsx` recebeu:
  - Select para alternar entre visualizar "Excluir internos (Real)", "Somente internos (Testes)", "Todos".
  - O filtro atua nas variáveis de estado (`filteredEvents`) e já reflete automaticamente na tabela "Resumo por criativo".
  - Alerta sutil exibido caso seja selecionado "Excluir internos" e existam registros sem UTM (`sem_utm_content`), avisando sobre análises manuais necessárias.
  - Badge vermelho identificando eventos marcados como `teste`.
- Build verificado localmente (`npm run build`) com sucesso (Exit code: 0).
