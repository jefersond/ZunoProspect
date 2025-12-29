-- Garantir que RLS está habilitado na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover policy existente se houver (para evitar conflito)
DROP POLICY IF EXISTS "Block anon select on profiles" ON public.profiles;

-- Criar policy para bloquear SELECT por usuários anônimos
CREATE POLICY "Block anon select on profiles" 
ON public.profiles 
FOR SELECT 
TO anon 
USING (false);

-- Também bloquear INSERT, UPDATE e DELETE para anon (defesa em profundidade)
DROP POLICY IF EXISTS "Block anon insert on profiles" ON public.profiles;
CREATE POLICY "Block anon insert on profiles" 
ON public.profiles 
FOR INSERT 
TO anon 
WITH CHECK (false);

DROP POLICY IF EXISTS "Block anon update on profiles" ON public.profiles;
CREATE POLICY "Block anon update on profiles" 
ON public.profiles 
FOR UPDATE 
TO anon 
USING (false);

DROP POLICY IF EXISTS "Block anon delete on profiles" ON public.profiles;
CREATE POLICY "Block anon delete on profiles" 
ON public.profiles 
FOR DELETE 
TO anon 
USING (false);