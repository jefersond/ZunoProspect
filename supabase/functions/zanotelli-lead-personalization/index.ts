import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_BODY_BYTES = 4096
const MAX_CLOCK_SKEW_SECONDS = 300
const MAX_HTML_BYTES = 512 * 1024
const MAX_SITE_PAGES = 4
const FETCH_TIMEOUT_MS = 4000
const REQUEST_ID_RE = /^[a-zA-Z0-9:_-]{8,180}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ADMIN_USER_ID = '293cbcc2-1262-4e22-845c-8178ca1dddff'
const CONTACT_HINT_RE = /(?:servi[cç]os?|solu[cç][oõ]es?|o que fazemos|quem somos|sobre|about|cases?|portfolio|portf[oó]lio)/i
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']

type SiteContext = {
  pagesChecked: number
  pageUrls: string[]
  title: string
  description: string
  headings: string[]
  snippets: string[]
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })
}

function clean(value: unknown, max = 1200) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function htmlText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function safeUrl(value: unknown) {
  const raw = clean(value, 500)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!host || host === 'localhost' || host.endsWith('.local')) return null
    if (/^(?:127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null
    const private172 = host.match(/^172\.(\d{1,3})\./)
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null
    if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function extractMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return htmlText(match[1]).slice(0, 500)
  }
  return ''
}

function extractTagTexts(html: string, tag: string, limit: number, maxChars: number) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const values: string[] = []
  for (const match of html.matchAll(re)) {
    const value = htmlText(match[1]).slice(0, maxChars)
    if (value && !values.some((item) => item.toLowerCase() === value.toLowerCase())) values.push(value)
    if (values.length >= limit) break
  }
  return values
}

function pageCandidates(base: URL, html: string) {
  const candidates = new Map<string, number>()
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,220}?)<\/a>/gi
  for (const match of html.matchAll(anchor)) {
    const href = match[1]
    const label = htmlText(match[2])
    if (!CONTACT_HINT_RE.test(`${href} ${label}`)) continue
    try {
      const url = new URL(href, base)
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin) continue
      url.hash = ''
      const hint = `${url.pathname} ${label}`.toLowerCase()
      const score = /servi|solu|o que fazemos/.test(hint) ? 4 : /case|portfolio|portfólio/.test(hint) ? 3 : /sobre|about|quem somos/.test(hint) ? 2 : 1
      candidates.set(url.toString(), Math.max(score, candidates.get(url.toString()) ?? 0))
    } catch {
      // Ignore malformed public links.
    }
  }
  for (const path of ['/servicos', '/serviços', '/solucoes', '/soluções', '/sobre', '/quem-somos', '/cases']) {
    const url = new URL(path, base)
    candidates.set(url.toString(), Math.max(candidates.get(url.toString()) ?? 0, /serv|solu/.test(path) ? 3 : 1))
  }
  return [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url).filter((url) => url !== base.toString()).slice(0, MAX_SITE_PAGES - 1)
}

async function fetchHtml(url: URL) {
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'user-agent': 'ZunoProspect/1.0 business-context' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) { await response.body?.cancel().catch(() => undefined); return '' }
    const finalUrl = safeUrl(response.url)
    if (!finalUrl || finalUrl.origin !== url.origin) { await response.body?.cancel().catch(() => undefined); return '' }
    const type = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (type && !type.includes('text/html') && !type.includes('application/xhtml+xml')) { await response.body?.cancel().catch(() => undefined); return '' }
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declared) && declared > MAX_HTML_BYTES * 2) { await response.body?.cancel().catch(() => undefined); return '' }
    return (await response.text()).slice(0, MAX_HTML_BYTES)
  } catch {
    return ''
  }
}

async function collectSiteContext(website: unknown): Promise<SiteContext> {
  const base = safeUrl(website)
  if (!base) return { pagesChecked: 0, pageUrls: [], title: '', description: '', headings: [], snippets: [] }
  const home = await fetchHtml(base)
  if (!home) return { pagesChecked: 0, pageUrls: [], title: '', description: '', headings: [], snippets: [] }

  const pages: Array<{ url: string; html: string }> = [{ url: base.toString(), html: home }]
  for (const candidate of pageCandidates(base, home)) {
    const parsed = safeUrl(candidate)
    if (!parsed || parsed.origin !== base.origin) continue
    const html = await fetchHtml(parsed)
    if (html) pages.push({ url: parsed.toString(), html })
    if (pages.length >= MAX_SITE_PAGES) break
  }

  const title = extractTagTexts(home, 'title', 1, 300)[0] ?? ''
  const description = extractMeta(home, 'description') || extractMeta(home, 'og:description')
  const headings: string[] = []
  const snippets: string[] = []
  for (const page of pages) {
    for (const value of [...extractTagTexts(page.html, 'h1', 4, 260), ...extractTagTexts(page.html, 'h2', 8, 260), ...extractTagTexts(page.html, 'h3', 8, 220)]) {
      if (value.length >= 3 && !headings.some((item) => item.toLowerCase() === value.toLowerCase())) headings.push(value)
      if (headings.length >= 12) break
    }
    for (const value of extractTagTexts(page.html, 'p', 12, 420)) {
      if (value.length < 45 || value.length > 420) continue
      if (!snippets.some((item) => item.toLowerCase() === value.toLowerCase())) snippets.push(value)
      if (snippets.length >= 10) break
    }
  }
  return { pagesChecked: pages.length, pageUrls: pages.map((page) => page.url), title, description, headings: headings.slice(0, 12), snippets: snippets.slice(0, 10) }
}

function normalizeCompanyName(value: unknown) {
  return clean(value, 180).replace(/\s*[|–—-]\s*(ag[eê]ncia de marketing.*|marketing digital.*)$/i, '').trim() || clean(value, 180)
}

function usefulFacts(lead: Record<string, unknown>, site: SiteContext) {
  const facts: string[] = []
  const company = normalizeCompanyName(lead.nome || lead.company_name)
  if (site.description) facts.push(`No site, a empresa se apresenta assim: ${site.description}`)
  for (const heading of site.headings.slice(0, 5)) facts.push(`Destaque público do site: ${heading}`)
  const rating = Number(lead.rating)
  const reviews = Number(lead.total_reviews)
  if (Number.isFinite(rating) && rating > 0) facts.push(`A empresa tem nota pública ${rating.toFixed(1).replace('.0', '')}/5 no Google${Number.isFinite(reviews) && reviews > 0 ? ` com ${Math.trunc(reviews)} avaliações` : ''}.`)
  const signals: string[] = []
  if (lead.whatsapp_on_site === true) signals.push('WhatsApp no site')
  if (lead.has_meta_pixel === true) signals.push('Meta Pixel')
  if (lead.has_gtag === true) signals.push('Google tag')
  if (lead.has_gtm === true) signals.push('Google Tag Manager')
  if (signals.length) facts.push(`Sinais digitais públicos detectados: ${signals.join(', ')}.`)
  if (clean(lead.cidade, 120)) facts.push(`Atuação/localização observada: ${clean(lead.cidade, 120)}.`)
  if (clean(lead.nicho || lead.industry, 160)) facts.push(`Segmento observado: ${clean(lead.nicho || lead.industry, 160)}.`)
  const diagnostic = Array.isArray(lead.diagnostico_bullets) ? lead.diagnostico_bullets : []
  for (const item of diagnostic.slice(0, 3)) if (clean(item, 600)) facts.push(`Diagnóstico Zuno: ${clean(item, 600)}`)
  return { company, facts: facts.slice(0, 10) }
}

function fallbackDraft(company: string, facts: string[]) {
  const primary = facts.find((fact) => fact.startsWith('No site,')) || facts.find((fact) => fact.startsWith('Destaque público')) || facts.find((fact) => fact.includes('nota pública')) || ''
  const secondary = facts.find((fact) => fact !== primary && (fact.includes('nota pública') || fact.includes('Sinais digitais') || fact.startsWith('Destaque público'))) || ''
  const observation = [primary, secondary].filter(Boolean).map((fact) => fact.replace(/^No site, a empresa se apresenta assim:\s*/i, '').replace(/^Destaque público do site:\s*/i, '')).join(' Também chamou atenção que ')
  const body = [
    'Olá, tudo bem?',
    '',
    observation
      ? `Estava olhando a presença digital da ${company} e um ponto me chamou atenção: ${observation.charAt(0).toLowerCase()}${observation.slice(1)}`
      : `Estava olhando a presença digital da ${company} e vi alguns pontos que podem ser úteis para uma conversa comercial mais previsível.`,
    '',
    'A Zuno Prospect foi criada justamente para agências e profissionais B2B encontrarem empresas por cidade e nicho, priorizarem oportunidades com contexto e chegarem na primeira abordagem sem partir de uma mensagem genérica.',
    '',
    `Se fizer sentido, posso te mostrar um exemplo usando a própria ${company} para você avaliar em poucos minutos.`,
    '',
    'Se preferir não receber esse tipo de contato, é só responder pedindo a remoção.',
    '',
    'Equipe Zuno Prospect',
  ].join('\n')
  return { subject: `Uma observação sobre a ${company}`.slice(0, 200), body: body.slice(0, 10500) }
}

async function callGemini(apiKey: string, company: string, facts: string[]) {
  const fallback = fallbackDraft(company, facts)
  const factBlock = facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n')
  const prompt = `Você escreve primeiro contato comercial B2B em português do Brasil para o produto Zuno Prospect.\n\nEMPRESA: ${company}\nFATOS PÚBLICOS/INTERNOS PERMITIDOS:\n${factBlock || 'Nenhum fato adicional confiável.'}\n\nPRODUTO: Zuno Prospect ajuda profissionais e agências B2B a encontrar empresas por cidade e nicho, priorizar oportunidades e preparar abordagens contextualizadas.\n\nREGRAS OBRIGATÓRIAS:\n- Gere um e-mail curto, natural e específico para esta empresa.\n- Use no máximo 2 fatos concretos acima e só quando forem úteis; nunca invente.\n- Não diga que espionou, rastreou, inspecionou pixel ou coletou dados.\n- Não use o nome pessoal do remetente. A assinatura deve ser exatamente "Equipe Zuno Prospect".\n- Não use elogio vazio como "vi o trabalho de vocês" sem um detalhe verificável.\n- O CTA deve ser leve: oferecer um exemplo aplicado à própria empresa.\n- Inclua opt-out claro e curto.\n- Não inclua link; o backend adicionará o link rastreável de WhatsApp depois.\n- Assunto com no máximo 70 caracteres.\n- Corpo com no máximo 1200 caracteres.\n\nResponda SOMENTE JSON válido no formato {"subject":"...","body":"..."}.`

  for (const model of MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 900, responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(14_000),
      })
      if (!response.ok) continue
      const data = await response.json()
      const raw = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
      const parsed = JSON.parse(raw)
      const subject = clean(parsed?.subject, 200)
      let body = clean(parsed?.body, 4000).replace(/\s*Jeferson\s*$/i, '').trim()
      if (!subject || !body || /\bJeferson\b/i.test(body)) continue
      if (!/Equipe Zuno Prospect\s*$/i.test(body)) body = `${body}\n\nEquipe Zuno Prospect`
      return { subject, body, model }
    } catch {
      // Try the next model, then deterministic fallback.
    }
  }
  return { ...fallback, model: 'deterministic-fallback' }
}

function hexToBytes(value: string) {
  const normalized = value.replace(/^sha256=/i, '').trim()
  if (!/^[0-9a-f]{64}$/i.test(normalized)) return null
  return new Uint8Array(normalized.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
}

async function verifyHmac(secret: string, message: string, signature: string) {
  const bytes = hexToBytes(signature)
  if (!bytes) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message))
}

serve(async (request) => {
  if (request.method !== 'POST') return json({ status: 'invalid_request' }, 405)
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ status: 'invalid_request' }, 413)
  const timestampHeader = request.headers.get('x-zanotelli-timestamp') ?? ''
  const signature = request.headers.get('x-zanotelli-signature') ?? ''
  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_CLOCK_SKEW_SECONDS) return json({ status: 'unauthorized' }, 401)
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ status: 'invalid_request' }, 413)
  let input: Record<string, unknown>
  try { input = JSON.parse(rawBody) } catch { return json({ status: 'invalid_request' }, 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['request_id', 'lead_reference'].includes(key))) return json({ status: 'invalid_request' }, 400)
  const requestId = clean(input.request_id, 180)
  const leadReference = clean(input.lead_reference, 80)
  if (!REQUEST_ID_RE.test(requestId) || !UUID_RE.test(leadReference)) return json({ status: 'invalid_request' }, 400)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !service) return json({ status: 'temporarily_unavailable' }, 503)
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const secretResult = await db.rpc('internal_zanotelli_context_bridge_secret')
  if (secretResult.error || typeof secretResult.data !== 'string' || !secretResult.data) return json({ status: 'temporarily_unavailable' }, 503)
  if (!(await verifyHmac(secretResult.data, `${timestampHeader}.${rawBody}`, signature))) return json({ status: 'unauthorized' }, 401)

  const leadResult = await db.from('leads')
    .select('id,user_id,nome,company_name,cidade,nicho,industry,website,rating,total_reviews,whatsapp_on_site,has_meta_pixel,has_gtag,has_gtm,diagnostico_bullets,probabilidade_conversao,probability_score,analysis_summary,plano_prospeccao,custom_fields,data_sources')
    .eq('id', leadReference).eq('user_id', ADMIN_USER_ID).maybeSingle()
  if (leadResult.error) return json({ status: 'temporarily_unavailable' }, 503)
  if (!leadResult.data) return json({ status: 'unresolved' }, 404)

  const lead = leadResult.data as Record<string, unknown>
  const site = await collectSiteContext(lead.website)
  const { company, facts } = usefulFacts(lead, site)
  const geminiKey = clean(Deno.env.get('GOOGLE_GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API') || '', 3000)
  const draft = geminiKey ? await callGemini(geminiKey, company, facts) : { ...fallbackDraft(company, facts), model: 'deterministic-fallback' }

  const context = {
    version: 1,
    generated_at: new Date().toISOString(),
    pages_checked: site.pagesChecked,
    page_urls: site.pageUrls.slice(0, MAX_SITE_PAGES),
    title: site.title,
    description: site.description,
    headings: site.headings.slice(0, 12),
    snippets: site.snippets.slice(0, 6),
    facts: facts.slice(0, 10),
    model: draft.model,
  }
  const currentCustom = lead.custom_fields && typeof lead.custom_fields === 'object' && !Array.isArray(lead.custom_fields) ? lead.custom_fields as Record<string, unknown> : {}
  const currentSources = lead.data_sources && typeof lead.data_sources === 'object' && !Array.isArray(lead.data_sources) ? lead.data_sources as Record<string, unknown> : {}
  await db.from('leads').update({
    custom_fields: { ...currentCustom, zanotelli_site_context: context },
    data_sources: { ...currentSources, zanotelli_site_context: { source: 'public_website', generated_at: context.generated_at, pages_checked: site.pagesChecked } },
  }).eq('id', leadReference).eq('user_id', ADMIN_USER_ID)

  return json({
    status: 'matched',
    request_id: requestId,
    lead_reference: leadReference,
    company_name: company,
    subject: draft.subject,
    body: draft.body,
    personalization: { facts_used: facts.slice(0, 10), site_context: context, sender_signature: 'Equipe Zuno Prospect', personal_sender_name_used: false },
  })
})