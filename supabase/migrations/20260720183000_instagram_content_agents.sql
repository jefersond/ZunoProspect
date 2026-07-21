-- Central de conteudo da Zuno para Instagram.
-- Mantem geracao, revisao, aprovacao, agendamento e publicacao auditaveis.

CREATE TABLE IF NOT EXISTS public.instagram_content_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  brand_name text NOT NULL DEFAULT 'Zuno Prospect',
  product_description text NOT NULL DEFAULT 'Plataforma de prospeccao que encontra empresas por cidade e nicho e cria abordagens comerciais contextualizadas.',
  target_audience text NOT NULL DEFAULT 'Prestadores de servico, agencias, consultores e vendedores B2B que precisam prospectar com mais consistencia.',
  brand_voice text NOT NULL DEFAULT 'Direta, pratica, humana, confiavel e sem promessas exageradas.',
  content_pillars text[] NOT NULL DEFAULT ARRAY[
    'Educacao sobre prospeccao',
    'Dores e erros da prospeccao manual',
    'Demonstracao da Zuno',
    'Rotina e produtividade comercial',
    'Objecoes e quebra de crencas',
    'Convite para testar a plataforma'
  ],
  posting_mode text NOT NULL DEFAULT 'approval'
    CHECK (posting_mode IN ('approval', 'automatic')),
  default_posts_per_week integer NOT NULL DEFAULT 3
    CHECK (default_posts_per_week BETWEEN 1 AND 7),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.instagram_content_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.instagram_content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'draft',
      'pending_review',
      'approved',
      'scheduled',
      'publishing',
      'published',
      'rejected',
      'failed'
    )),
  objective text NOT NULL DEFAULT 'awareness',
  format text NOT NULL DEFAULT 'single'
    CHECK (format IN ('single', 'carousel')),
  pillar text,
  theme text NOT NULL,
  target_audience text,
  hook text NOT NULL,
  caption text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  cta text,
  alt_text text,
  visual_brief text,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_url text,
  media_urls text[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  instagram_container_id text,
  instagram_media_id text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_error text,
  agent_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_content_status_schedule
  ON public.instagram_content_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_instagram_content_created
  ON public.instagram_content_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_content_batch
  ON public.instagram_content_posts(batch_id);

ALTER TABLE public.instagram_content_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_content_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage Instagram settings" ON public.instagram_content_settings;
CREATE POLICY "Admins manage Instagram settings"
ON public.instagram_content_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role manages Instagram settings" ON public.instagram_content_settings;
CREATE POLICY "Service role manages Instagram settings"
ON public.instagram_content_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage Instagram content" ON public.instagram_content_posts;
CREATE POLICY "Admins manage Instagram content"
ON public.instagram_content_posts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role manages Instagram content" ON public.instagram_content_posts;
CREATE POLICY "Service role manages Instagram content"
ON public.instagram_content_posts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_instagram_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instagram_content_posts_updated_at
  ON public.instagram_content_posts;
CREATE TRIGGER trg_instagram_content_posts_updated_at
BEFORE UPDATE ON public.instagram_content_posts
FOR EACH ROW
EXECUTE FUNCTION public.touch_instagram_content_updated_at();

DROP TRIGGER IF EXISTS trg_instagram_content_settings_updated_at
  ON public.instagram_content_settings;
CREATE TRIGGER trg_instagram_content_settings_updated_at
BEFORE UPDATE ON public.instagram_content_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_instagram_content_updated_at();

COMMENT ON TABLE public.instagram_content_posts IS
  'Fila auditavel de posts criados pelos agentes de estrategia, copy e revisao da Zuno.';
COMMENT ON COLUMN public.instagram_content_settings.posting_mode IS
  'approval exige aprovacao humana; automatic permite agendar lotes automaticamente.';