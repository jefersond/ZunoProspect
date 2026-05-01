-- 1. Adicionar as novas colunas na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS buscas_saldo INTEGER DEFAULT 0;

-- 2. Função para gerar um referral code único automaticamente se não tiver
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    -- Gera um código único baseado no ID ou randomico (ex: ref_a1b2c3d4)
    NEW.referral_code := 'ref_' || substr(md5(random()::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para garantir que todo usuário tenha um referral_code
DROP TRIGGER IF EXISTS ensure_referral_code ON public.profiles;
CREATE TRIGGER ensure_referral_code
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- 3. Função do Motor de Indicação (Gatilho no INSERT via Email/Senha)
CREATE OR REPLACE FUNCTION process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id UUID;
  referral_code_used TEXT;
BEGIN
  SELECT raw_user_meta_data->>'referred_by_code' INTO referral_code_used 
  FROM auth.users 
  WHERE id = NEW.id;

  IF referral_code_used IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = referral_code_used LIMIT 1;
    
    IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
      NEW.referred_by := referrer_id;
      
      UPDATE public.profiles 
      SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100 
      WHERE id = referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_reward ON public.profiles;
CREATE TRIGGER on_profile_created_reward
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION process_referral_reward();

-- 4. Função do Motor de Indicação (Gatilho no UPDATE - útil para OAuth)
CREATE OR REPLACE FUNCTION process_referral_reward_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se o referred_by está sendo definido pela primeira vez
  IF OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL THEN
    IF NEW.referred_by != NEW.id THEN
      UPDATE public.profiles 
      SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100 
      WHERE id = NEW.referred_by;
    ELSE
      NEW.referred_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_reward ON public.profiles;
CREATE TRIGGER on_profile_update_reward
BEFORE UPDATE OF referred_by ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION process_referral_reward_on_update();

-- 5. Criar função auxiliar para recriar códigos para usuários antigos
UPDATE public.profiles SET referral_code = 'ref_' || substr(md5(random()::text), 1, 8) WHERE referral_code IS NULL;
