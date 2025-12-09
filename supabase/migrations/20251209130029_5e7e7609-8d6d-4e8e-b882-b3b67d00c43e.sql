-- Fix profiles table RLS policies

-- 1. Drop the overly broad "Block anon" policies that conflict with authenticated user policies
-- These RESTRICTIVE policies with USING(false) block ALL users, not just anonymous
DROP POLICY IF EXISTS "Block anon select" ON public.profiles;
DROP POLICY IF EXISTS "Block anon insert" ON public.profiles;
DROP POLICY IF EXISTS "Block anon update" ON public.profiles;
DROP POLICY IF EXISTS "Block anon delete" ON public.profiles;

-- 2. Recreate anon blocking policies that specifically target the anon role only
CREATE POLICY "Block anon select on profiles"
ON public.profiles FOR SELECT
TO anon
USING (false);

CREATE POLICY "Block anon insert on profiles"
ON public.profiles FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Block anon update on profiles"
ON public.profiles FOR UPDATE
TO anon
USING (false);

CREATE POLICY "Block anon delete on profiles"
ON public.profiles FOR DELETE
TO anon
USING (false);

-- 3. Add missing DELETE policy for authenticated users
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);