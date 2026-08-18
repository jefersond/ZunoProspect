-- Private read-only context bridge for Zanotelli OS.
-- Resolves only explicitly scoped Zuno users and never returns contact PII.

create table if not exists public.zanotelli_context_scope_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zanotelli_context_scope_users enable row level security;
revoke all on table public.zanotelli_context_scope_users from anon, authenticated;
grant select on table public.zanotelli_context_scope_users to service_role;

create or replace function public.zanotelli_normalize_phone(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when char_length(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g')) > 11
      then right(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), 11)
    else regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g')
  end
$$;

create or replace function public.zanotelli_phone_lookup_hash(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when char_length(public.zanotelli_normalize_phone(value)) between 10 and 11
      then encode(digest('zanotelli-phone:v1:' || public.zanotelli_normalize_phone(value), 'sha256'), 'hex')
    else null
  end
$$;

revoke all on function public.zanotelli_normalize_phone(text) from public;
revoke all on function public.zanotelli_phone_lookup_hash(text) from public;
grant execute on function public.zanotelli_normalize_phone(text) to service_role;
grant execute on function public.zanotelli_phone_lookup_hash(text) to service_role;

create or replace function public.internal_zanotelli_context_bridge_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = 'zanotelli_context_bridge_secret'
  order by created_at desc
  limit 1;

  if coalesce(secret_value, '') = '' then
    raise exception 'ZANOTELLI_CONTEXT_SECRET_NOT_CONFIGURED' using errcode = '42501';
  end if;

  return secret_value;
end;
$$;

revoke all on function public.internal_zanotelli_context_bridge_secret() from public, anon, authenticated;
grant execute on function public.internal_zanotelli_context_bridge_secret() to service_role;

create or replace function public.internal_lookup_zanotelli_lead_context(p_phone_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_count integer := 0;
  lead_row public.leads%rowtype;
  analysis_row public.lead_analyses%rowtype;
  normalized_hash text := lower(trim(coalesce(p_phone_hash, '')));
  likely_objections jsonb := '[]'::jsonb;
begin
  if normalized_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select count(*) into candidate_count
  from public.leads lead
  join public.zanotelli_context_scope_users scope
    on scope.user_id = lead.user_id
   and scope.active = true
  where public.zanotelli_phone_lookup_hash(
    coalesce(
      nullif(lead.whatsapp_number, ''),
      nullif(lead.whatsapp, ''),
      nullif(lead.telefone, ''),
      nullif(lead.cnpj_telefone, '')
    )
  ) = normalized_hash;

  if candidate_count = 0 then
    return jsonb_build_object('status', 'unresolved', 'candidate_count', 0);
  end if;

  if candidate_count <> 1 then
    return jsonb_build_object('status', 'ambiguous', 'candidate_count', candidate_count);
  end if;

  select lead.* into lead_row
  from public.leads lead
  join public.zanotelli_context_scope_users scope
    on scope.user_id = lead.user_id
   and scope.active = true
  where public.zanotelli_phone_lookup_hash(
    coalesce(
      nullif(lead.whatsapp_number, ''),
      nullif(lead.whatsapp, ''),
      nullif(lead.telefone, ''),
      nullif(lead.cnpj_telefone, '')
    )
  ) = normalized_hash
  limit 1;

  select analysis.* into analysis_row
  from public.lead_analyses analysis
  where analysis.lead_id = lead_row.id
  order by (analysis.status = 'approved') desc, analysis.created_at desc
  limit 1;

  if jsonb_typeof(lead_row.plano_prospeccao) = 'array' then
    select coalesce(jsonb_agg(item) filter (where item <> '{}'::jsonb), '[]'::jsonb)
      into likely_objections
    from (
      select jsonb_strip_nulls(jsonb_build_object(
        'objection', nullif(left(coalesce(step->>'objecao_provavel', ''), 500), ''),
        'suggested_response', nullif(left(coalesce(step->>'resposta_sugerida', ''), 800), '')
      )) as item
      from jsonb_array_elements(lead_row.plano_prospeccao) step
      where coalesce(step->>'objecao_provavel', '') <> ''
      limit 4
    ) selected;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'status', 'matched',
    'context_version', 1,
    'lead_reference', lead_row.id,
    'company', jsonb_strip_nulls(jsonb_build_object(
      'name', nullif(left(coalesce(lead_row.nome, lead_row.company_name, ''), 180), ''),
      'city', nullif(left(coalesce(lead_row.cidade, ''), 120), ''),
      'segment', nullif(left(coalesce(lead_row.nicho, lead_row.industry, ''), 160), ''),
      'focus', nullif(left(coalesce(lead_row.foco, ''), 120), ''),
      'website', nullif(left(coalesce(lead_row.website, ''), 300), ''),
      'instagram', nullif(left(coalesce(lead_row.instagram_url, lead_row.instagram, ''), 300), ''),
      'company_size', nullif(left(coalesce(lead_row.porte_empresa, ''), 120), ''),
      'main_activity', nullif(left(coalesce(lead_row.cnae_principal, ''), 220), ''),
      'google_rating', lead_row.rating,
      'google_reviews', lead_row.total_reviews
    )),
    'digital_signals', jsonb_strip_nulls(jsonb_build_object(
      'whatsapp_on_site', coalesce(lead_row.whatsapp_on_site, false),
      'meta_pixel', coalesce(lead_row.has_meta_pixel, false),
      'google_tag', coalesce(lead_row.has_gtag, false),
      'google_tag_manager', coalesce(lead_row.has_gtm, false)
    )),
    'commercial_intelligence', jsonb_strip_nulls(jsonb_build_object(
      'probability_score', coalesce(lead_row.probabilidade_conversao, lead_row.probability_score),
      'diagnostic_bullets', lead_row.diagnostico_bullets,
      'analysis_summary', nullif(left(coalesce(lead_row.analysis_summary, ''), 1800), ''),
      'likely_objections', likely_objections,
      'ai_generated_at', lead_row.ai_analise_gerada_em,
      'used_fallback', lead_row.ai_used_fallback,
      'fallback_reason', nullif(left(coalesce(lead_row.ai_fallback_reason, ''), 300), '')
    )),
    'latest_analysis', case
      when analysis_row.id is null then null
      else jsonb_strip_nulls(jsonb_build_object(
        'status', analysis_row.status,
        'approved', analysis_row.status = 'approved',
        'priority', nullif(left(coalesce(analysis_row.priority, ''), 40), ''),
        'opportunity', nullif(left(coalesce(analysis_row.opportunity_summary, ''), 1200), ''),
        'possible_pain', nullif(left(coalesce(analysis_row.possible_pain, ''), 1000), ''),
        'approach_angle', nullif(left(coalesce(analysis_row.approach_angle, ''), 1000), '')
      ))
    end,
    'data_quality', jsonb_strip_nulls(jsonb_build_object(
      'sources', lead_row.data_sources,
      'processing_status', nullif(left(coalesce(lead_row.processing_status, ''), 80), '')
    ))
  ));
end;
$$;

revoke all on function public.internal_lookup_zanotelli_lead_context(text) from public, anon, authenticated;
grant execute on function public.internal_lookup_zanotelli_lead_context(text) to service_role;
