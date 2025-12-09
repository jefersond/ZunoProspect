-- Drop the old constraint
ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;

-- Create new constraint with all pipeline statuses
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status = ANY (ARRAY[
  'novo'::text, 
  'em_contato'::text, 
  'qualificacao'::text, 
  'negociacao'::text, 
  'convertido'::text, 
  'perdido'::text,
  -- Keep legacy values for backward compatibility
  'contatado'::text, 
  'qualificado'::text, 
  'descartado'::text
]));