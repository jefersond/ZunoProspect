-- Drop old constraint and add new one with starter_inativos option
ALTER TABLE public.email_campaigns 
DROP CONSTRAINT email_campaigns_segmento_check;

ALTER TABLE public.email_campaigns 
ADD CONSTRAINT email_campaigns_segmento_check 
CHECK (segmento = ANY (ARRAY['inativos'::text, 'starter_inativos'::text, 'nao_pagantes'::text, 'engajados_nao_pagantes'::text, 'proximo_limite'::text, 'todos'::text]));