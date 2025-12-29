-- 1. Adicionar novas colunas para email criptografado e mascarado
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS user_email_encrypted bytea,
ADD COLUMN IF NOT EXISTS user_email_masked text;

-- 2. Migrar dados existentes: criptografar emails e criar versão mascarada
UPDATE public.email_logs
SET 
  user_email_encrypted = public.encrypt_sensitive(user_email),
  user_email_masked = CONCAT(
    LEFT(SPLIT_PART(user_email, '@', 1), 2),
    '***@',
    SPLIT_PART(user_email, '@', 2)
  )
WHERE user_email IS NOT NULL 
  AND user_email_encrypted IS NULL;

-- 3. Remover a coluna original (texto puro) - IMPORTANTE para segurança
ALTER TABLE public.email_logs DROP COLUMN IF EXISTS user_email;

-- 4. Tornar a coluna mascarada NOT NULL para novos registros
ALTER TABLE public.email_logs ALTER COLUMN user_email_masked SET NOT NULL;