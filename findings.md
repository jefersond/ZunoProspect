# VLAEG - Findings
- O Supabase remoto (ihtltqxxlvbsxbiacbpr) já possui as tabelas (`leads`) criadas, o que está causando erro no `supabase db push` da migration `20260502133000_email_remarketing_safety.sql`. 
- As Edge Functions de e-mail agora dependem diretamente das variáveis de ambiente setadas no Supabase dashboard (`RESEND_API_KEY`, etc).
- O diagnóstico do Painel Admin em `/admin/email` faz a invocação do `test-email-config` e já está implementado no componente `EmailTestCard.tsx`.
