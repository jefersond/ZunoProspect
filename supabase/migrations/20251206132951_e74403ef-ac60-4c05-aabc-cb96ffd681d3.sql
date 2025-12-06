-- Block anonymous access to profiles table
-- This prevents unauthenticated users from querying profile data

CREATE POLICY "Block anonymous access" ON public.profiles
FOR ALL TO anon USING (false) WITH CHECK (false);