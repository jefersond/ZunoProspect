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

-- 3. Função do Motor de Indicação (Gatilho)
-- Quando um novo perfil for criado (o que acontece logo após o cadastro do auth.users)
CREATE OR REPLACE FUNCTION process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id UUID;
  referral_code_used TEXT;
BEGIN
  -- Tenta pegar o código de indicação que veio do Auth metadata
  -- Nota: No Supabase, o auth.users propaga o raw_user_meta_data.
  -- Como a trigger ideal para pegar o metadata no momento do cadastro é em auth.users,
  -- precisamos checar de onde estamos extraindo. Como estamos lidando com a tabela profiles,
  -- assumiremos que uma trigger em auth.users lida melhor com raw_user_meta_data.

  -- Vamos olhar a tabela auth.users correspondente
  SELECT raw_user_meta_data->>'referred_by_code' INTO referral_code_used 
  FROM auth.users 
  WHERE id = NEW.id;

  IF referral_code_used IS NOT NULL THEN
    -- Acha o dono do código
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = referral_code_used LIMIT 1;
    
    IF referrer_id IS NOT NULL THEN
      -- Define quem indicou o novo usuário
      NEW.referred_by := referrer_id;
      
      -- E AQUI A MÁGICA ACONTECE: Soma 100 ao saldo do dono do código
      UPDATE public.profiles 
      SET buscas_saldo = COALESCE(buscas_saldo, 0) + 100 
      WHERE id = referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para processar a recompensa no momento que o profile é criado
DROP TRIGGER IF EXISTS on_profile_created_reward ON public.profiles;
CREATE TRIGGER on_profile_created_reward
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION process_referral_reward();

-- 4. Criar função auxiliar para recriar códigos para usuários antigos
UPDATE public.profiles SET referral_code = 'ref_' || substr(md5(random()::text), 1, 8) WHERE referral_code IS NULL;
