-- 1. Garantir que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Revogar permissões diretas do public
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 3. Remover policies existentes para recriar de forma limpa
DROP POLICY IF EXISTS "Block anonymous access" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON public.profiles;

-- 4. Criar policy que bloqueia anon EXPLICITAMENTE para cada operação
CREATE POLICY "Block anon select" 
ON public.profiles 
FOR SELECT 
TO anon
USING (false);

CREATE POLICY "Block anon insert" 
ON public.profiles 
FOR INSERT 
TO anon
WITH CHECK (false);

CREATE POLICY "Block anon update" 
ON public.profiles 
FOR UPDATE 
TO anon
USING (false);

CREATE POLICY "Block anon delete" 
ON public.profiles 
FOR DELETE 
TO anon
USING (false);

-- 5. Criar policies para authenticated - apenas próprio perfil
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- Nenhuma policy de DELETE - usuários não podem deletar perfis