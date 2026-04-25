-- ============================================================
-- MIGRATION: Regras de negócio para novos usuários
-- 1. Novos usuários começam com 10 buscas (trial gratuito)
-- 2. Corrige perfis existentes sem buscas_saldo definido
-- ============================================================

-- Garante que a coluna buscas_saldo existe com default 10
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buscas_saldo INTEGER NOT NULL DEFAULT 10;

-- Corrige usuários que já existem sem saldo definido (ou com 0)
-- Se não tiver assinatura ativa, define 10. Se tiver, mantém o que tem.
UPDATE public.profiles p
SET buscas_saldo = 10
WHERE p.buscas_saldo = 0
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id
      AND s.status = 'active'
  );

-- Atualiza o trigger handle_new_user para iniciar com 10 buscas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, buscas_saldo)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    10  -- trial gratuito: máximo de 10 buscas
  );
  RETURN NEW;
END;
$$;

-- Recria o trigger (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
