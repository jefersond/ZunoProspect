-- Adiciona policy para INSERT na tabela user_subscriptions
CREATE POLICY "Users can insert their own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);