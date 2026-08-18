-- Deterministic identity resolution v2 for the private Zanotelli context bridge.
-- The bridge remains scoped to explicitly authorized Zuno users and never returns contact PII.

create or replace function public.zanotelli_normalize_identity_text(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(
    translate(lower(trim(coalesce(value, ''))), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

create or replace function public.zanotelli_normalize_email(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(trim(coalesce(value, ''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then lower(trim(value))
    else null
  end
$$;

create or replace function public.zanotelli_normalize_domain(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(split_part(split_part(
    regexp_replace(regexp_replace(lower(trim(coalesce(value, ''))), '^https?://', ''), '^www\.', ''), '/', 1
  ), ':', 1), '')
$$;

create or replace function public.zanotelli_email_lookup_hash(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when public.zanotelli_normalize_email(value) is not null
    then encode(digest('zanotelli-email:v1:' || public.zanotelli_normalize_email(value), 'sha256'), 'hex') else null end
$$;

create or replace function public.zanotelli_domain_lookup_hash(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when public.zanotelli_normalize_domain(value) ~ '^[a-z0-9][a-z0-9.-]{1,251}\.[a-z]{2,63}$'
    then encode(digest('zanotelli-domain:v1:' || public.zanotelli_normalize_domain(value), 'sha256'), 'hex') else null end
$$;

create or replace function public.zanotelli_company_lookup_hash(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when char_length(public.zanotelli_normalize_identity_text(value)) between 2 and 180
    then encode(digest('zanotelli-company:v1:' || public.zanotelli_normalize_identity_text(value), 'sha256'), 'hex') else null end
$$;

create or replace function public.zanotelli_responsible_lookup_hash(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case when char_length(public.zanotelli_normalize_identity_text(value)) between 2 and 180
    then encode(digest('zanotelli-responsible:v1:' || public.zanotelli_normalize_identity_text(value), 'sha256'), 'hex') else null end
$$;

revoke all on function public.zanotelli_normalize_identity_text(text) from public;
revoke all on function public.zanotelli_normalize_email(text) from public;
revoke all on function public.zanotelli_normalize_domain(text) from public;
revoke all on function public.zanotelli_email_lookup_hash(text) from public;
revoke all on function public.zanotelli_domain_lookup_hash(text) from public;
revoke all on function public.zanotelli_company_lookup_hash(text) from public;
revoke all on function public.zanotelli_responsible_lookup_hash(text) from public;
grant execute on function public.zanotelli_normalize_identity_text(text) to service_role;
grant execute on function public.zanotelli_normalize_email(text) to service_role;
grant execute on function public.zanotelli_normalize_domain(text) to service_role;
grant execute on function public.zanotelli_email_lookup_hash(text) to service_role;
grant execute on function public.zanotelli_domain_lookup_hash(text) to service_role;
grant execute on function public.zanotelli_company_lookup_hash(text) to service_role;
grant execute on function public.zanotelli_responsible_lookup_hash(text) to service_role;

create or replace function public.internal_lookup_zanotelli_lead_context_v2(
  p_lead_reference uuid default null,
  p_phone_hash text default null,
  p_email_hash text default null,
  p_domain_hash text default null,
  p_company_hash text default null,
  p_responsible_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_count integer := 0;
  selected_lead_id uuid;
  matched_by text;
  lead_row public.leads%rowtype;
  analysis_row public.lead_analyses%rowtype;
  likely_objections jsonb := '[]'::jsonb;
  phone_hash text := lower(trim(coalesce(p_phone_hash, '')));
  email_hash text := lower(trim(coalesce(p_email_hash, '')));
  domain_hash text := lower(trim(coalesce(p_domain_hash, '')));
  company_hash text := lower(trim(coalesce(p_company_hash, '')));
  responsible_hash text := lower(trim(coalesce(p_responsible_hash, '')));
begin
  if p_lead_reference is not null then
    select count(*), min(lead.id::text)::uuid into candidate_count, selected_lead_id
    from public.leads lead
    join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
    where lead.id = p_lead_reference;
    if candidate_count = 1 then matched_by := 'lead_reference'; end if;
  end if;

  if matched_by is null and phone_hash ~ '^[0-9a-f]{64}$' then
    select count(distinct lead.id), min(lead.id::text)::uuid into candidate_count, selected_lead_id
    from public.leads lead
    join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
    where public.zanotelli_phone_lookup_hash(lead.whatsapp_number) = phone_hash
       or public.zanotelli_phone_lookup_hash(lead.whatsapp) = phone_hash
       or public.zanotelli_phone_lookup_hash(lead.telefone) = phone_hash
       or public.zanotelli_phone_lookup_hash(lead.cnpj_telefone) = phone_hash;
    if candidate_count = 1 then matched_by := 'phone';
    elsif candidate_count > 1 then return jsonb_build_object('status','ambiguous','candidate_count',candidate_count,'matched_by','phone'); end if;
  end if;

  if matched_by is null and email_hash ~ '^[0-9a-f]{64}$' then
    select count(distinct lead.id), min(lead.id::text)::uuid into candidate_count, selected_lead_id
    from public.leads lead
    join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
    where public.zanotelli_email_lookup_hash(lead.email) = email_hash or public.zanotelli_email_lookup_hash(lead.cnpj_email) = email_hash;
    if candidate_count = 1 then matched_by := 'email';
    elsif candidate_count > 1 then return jsonb_build_object('status','ambiguous','candidate_count',candidate_count,'matched_by','email'); end if;
  end if;

  if matched_by is null and domain_hash ~ '^[0-9a-f]{64}$' then
    select count(distinct lead.id), min(lead.id::text)::uuid into candidate_count, selected_lead_id
    from public.leads lead
    join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
    where public.zanotelli_domain_lookup_hash(lead.website) = domain_hash;
    if candidate_count = 1 then matched_by := 'domain';
    elsif candidate_count > 1 then return jsonb_build_object('status','ambiguous','candidate_count',candidate_count,'matched_by','domain'); end if;
  end if;

  if matched_by is null and company_hash ~ '^[0-9a-f]{64}$' then
    if responsible_hash ~ '^[0-9a-f]{64}$' then
      select count(distinct lead.id), min(lead.id::text)::uuid into candidate_count, selected_lead_id
      from public.leads lead
      join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
      where (public.zanotelli_company_lookup_hash(lead.nome) = company_hash or public.zanotelli_company_lookup_hash(lead.company_name) = company_hash)
        and public.zanotelli_responsible_lookup_hash(lead.nome_responsavel) = responsible_hash;
      if candidate_count = 1 then matched_by := 'company_responsible';
      elsif candidate_count > 1 then return jsonb_build_object('status','ambiguous','candidate_count',candidate_count,'matched_by','company_responsible'); end if;
    end if;
    if matched_by is null then
      select count(distinct lead.id), min(lead.id::text)::uuid into candidate_count, selected_lead_id
      from public.leads lead
      join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
      where public.zanotelli_company_lookup_hash(lead.nome) = company_hash or public.zanotelli_company_lookup_hash(lead.company_name) = company_hash;
      if candidate_count = 1 then matched_by := 'company';
      elsif candidate_count > 1 then return jsonb_build_object('status','ambiguous','candidate_count',candidate_count,'matched_by','company'); end if;
    end if;
  end if;

  if matched_by is null or selected_lead_id is null then return jsonb_build_object('status','unresolved','candidate_count',0); end if;

  select lead.* into lead_row
  from public.leads lead
  join public.zanotelli_context_scope_users scope on scope.user_id = lead.user_id and scope.active = true
  where lead.id = selected_lead_id limit 1;
  if lead_row.id is null then return jsonb_build_object('status','unresolved','candidate_count',0); end if;

  select analysis.* into analysis_row from public.lead_analyses analysis
  where analysis.lead_id = lead_row.id
  order by (analysis.status = 'approved') desc, analysis.created_at desc limit 1;

  if jsonb_typeof(lead_row.plano_prospeccao) = 'array' then
    select coalesce(jsonb_agg(item) filter (where item <> '{}'::jsonb), '[]'::jsonb) into likely_objections
    from (
      select jsonb_strip_nulls(jsonb_build_object(
        'objection', nullif(left(coalesce(step->>'objecao_provavel',''),500),''),
        'suggested_response', nullif(left(coalesce(step->>'resposta_sugerida',''),800),'')
      )) as item
      from jsonb_array_elements(lead_row.plano_prospeccao) step
      where coalesce(step->>'objecao_provavel','') <> '' limit 4
    ) selected;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'status','matched','context_version',2,'matched_by',matched_by,'lead_reference',lead_row.id,
    'company',jsonb_strip_nulls(jsonb_build_object(
      'name',nullif(left(coalesce(lead_row.nome,lead_row.company_name,''),180),''),
      'city',nullif(left(coalesce(lead_row.cidade,''),120),''),
      'segment',nullif(left(coalesce(lead_row.nicho,lead_row.industry,''),160),''),
      'focus',nullif(left(coalesce(lead_row.foco,''),120),''),
      'website',nullif(left(coalesce(lead_row.website,''),300),''),
      'instagram',nullif(left(coalesce(lead_row.instagram_url,lead_row.instagram,''),300),''),
      'company_size',nullif(left(coalesce(lead_row.porte_empresa,''),120),''),
      'main_activity',nullif(left(coalesce(lead_row.cnae_principal,''),220),''),
      'google_rating',lead_row.rating,'google_reviews',lead_row.total_reviews)),
    'digital_signals',jsonb_strip_nulls(jsonb_build_object(
      'whatsapp_on_site',coalesce(lead_row.whatsapp_on_site,false),'meta_pixel',coalesce(lead_row.has_meta_pixel,false),
      'google_tag',coalesce(lead_row.has_gtag,false),'google_tag_manager',coalesce(lead_row.has_gtm,false))),
    'commercial_intelligence',jsonb_strip_nulls(jsonb_build_object(
      'probability_score',coalesce(lead_row.probabilidade_conversao,lead_row.probability_score),
      'diagnostic_bullets',lead_row.diagnostico_bullets,'analysis_summary',nullif(left(coalesce(lead_row.analysis_summary,''),1800),''),
      'likely_objections',likely_objections,'ai_generated_at',lead_row.ai_analise_gerada_em,'used_fallback',lead_row.ai_used_fallback,
      'fallback_reason',nullif(left(coalesce(lead_row.ai_fallback_reason,''),300),''))),
    'latest_analysis',case when analysis_row.id is null then null else jsonb_strip_nulls(jsonb_build_object(
      'status',analysis_row.status,'approved',analysis_row.status='approved','priority',nullif(left(coalesce(analysis_row.priority,''),40),''),
      'opportunity',nullif(left(coalesce(analysis_row.opportunity_summary,''),1200),''),'possible_pain',nullif(left(coalesce(analysis_row.possible_pain,''),1000),''),
      'approach_angle',nullif(left(coalesce(analysis_row.approach_angle,''),1000),''))) end,
    'data_quality',jsonb_strip_nulls(jsonb_build_object('sources',lead_row.data_sources,'processing_status',nullif(left(coalesce(lead_row.processing_status,''),80),'')))
  ));
end;
$$;

revoke all on function public.internal_lookup_zanotelli_lead_context_v2(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.internal_lookup_zanotelli_lead_context_v2(uuid,text,text,text,text,text) to service_role;
