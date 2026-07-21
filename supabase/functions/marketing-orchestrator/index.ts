import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getMarketingPlaybook } from "./playbooks.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const adminEmails = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);

type Json = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof createClient>;

type AgentDefinition = {
  key: string;
  title: string;
  brief: string;
  mission: string;
  schema: string;
  requiresApproval: boolean;
  stage: number;
};

const agents: AgentDefinition[] = [
  {
    key: "marketing_director",
    title: "Direcao da campanha",
    brief: "Definir o foco comercial e distribuir uma estrategia executavel para todo o time.",
    mission: "Voce e o DIRETOR DE MARKETING (CMO) da Zuno. Projete e coordene o funil completo: descoberta no Instagram, educacao, acao iniciada pelo usuario, transferencia consentida para WhatsApp, qualificacao e venda consultiva assincrona, checkout no site, ativacao do teste, conversao em assinatura, onboarding, retencao, expansao e indicacao. Cada etapa deve ter um objetivo, conteudo, gatilho de entrada, evento de conversao, automacao, metrica e criterio de saida. Nao proponha reuniao ou agendamento. A verba informada limita somente anuncios pagos; ela nao limita agentes, conteudo organico, prospeccao ou ferramentas. Nao invente provas ou resultados. Priorize receita, aprendizado e handoffs claros para os especialistas.",
    schema: '{"executive_summary":"","positioning":"","primary_goal":"","offer_strategy":{"promise":"","mechanism":"","proof_needed":[]},"audience_hypotheses":[{"segment":"","pain":"","buying_trigger":"","objection":""}],"funnel":[{"stage":"","awareness_level":"","channel":"","objective":"","content":"","entry_condition":"","action":"","automation":"","exit_condition":"","conversion_event":"","metric":""}],"post_sale":{"activation_milestones":[],"onboarding_sequence":[],"retention_triggers":[],"trial_conversion":[],"referral_moment":""},"product_ladder":[{"idea":"","buyer_stage":"","value":"","validation_test":"","build_now":false}],"priorities_next_7_days":[],"success_criteria":[],"handoffs":{"traffic_manager":"","copywriter":"","creative_director":"","social_media":"","sdr":"","closer":"","performance_analyst":""}}',
    requiresApproval: false,
    stage: 10,
  },
  {
    key: "traffic_manager",
    title: "Plano de midia e testes",
    brief: "Criar a estrutura de trafego pago, segmentacao, distribuicao da verba e regras de decisao.",
    mission: "Voce e um GESTOR DE TRAFEGO senior, especialista em SaaS B2B com verba pequena. O teto informado e exclusivamente para compra de midia paga. Proponha somente anuncios que caibam nele, sem reduzir ou limitar o trabalho organico dos demais agentes. Nao afirme que a campanha ja foi publicada e nao prometa CPL, ROAS ou vendas. Toda ativacao e alteracao de investimento em anuncios depende de aprovacao humana.",
    schema: '{"objective":"","recommended_channel":"","budget":{"monthly":0,"daily":0,"allocation":[]},"campaign_structure":[{"campaign":"","ad_set":"","ads":[]}],"audiences":[{"name":"","location":"","signals":[],"exclusions":[]}],"placements":[],"optimization_event":"","tests":[{"hypothesis":"","variable":"","minimum_signal":""}],"launch_checklist":[],"stop_rules":[],"scale_rules":[],"utm_pattern":""}',
    requiresApproval: true,
    stage: 20,
  },
  {
    key: "copywriter",
    title: "Copies de aquisicao",
    brief: "Produzir anuncios e mensagem principal da pagina sem exageros ou afirmacoes inventadas.",
    mission: "Voce e um COPYWRITER senior de resposta direta para SaaS B2B. Escreva em portugues brasileiro natural, especifico e persuasivo. Use apenas fatos fornecidos. Nao invente clientes, depoimentos, estatisticas, escassez, funcionalidades ou resultados. Venda o proximo passo, nao uma promessa milagrosa. Cubra a jornada inteira: descoberta, nutricao, convite ao teste, recuperacao de checkout, ativacao, conversao da avaliacao em assinatura e pos-venda.",
    schema: '{"message_strategy":{"big_idea":"","core_pain":"","desired_outcome":"","mechanism":"","tone":""},"objections":[{"objection":"","response":""}],"organic_ctas":[{"stage":"","cta":"","support_text":""}],"nurturing":[{"touch":1,"timing":"","objective":"","message":"","cta":""}],"checkout_recovery":[{"timing":"","angle":"","message":"","cta":""}],"trial_activation":[{"day":0,"goal":"","message":"","cta":""}],"post_sale":[{"moment":"","message":"","cta":""}],"ads":[{"name":"","angle":"","primary_text":"","headline":"","description":"","cta":""}],"landing_page":{"eyebrow":"","headline":"","subheadline":"","benefits":[],"cta":"","risk_reversal":""},"copy_guardrails":[]}',
    requiresApproval: true,
    stage: 30,
  },
  {
    key: "creative_director",
    title: "Direcao de arte e criativos",
    brief: "Transformar estrategia e copy em conceitos visuais prontos para producao.",
    mission: "Voce e um DIRETOR DE ARTE e DESIGNER senior de performance. Crie briefings visuais especificos, simples de produzir e coerentes com uma marca SaaS premium escura, verde e branca. Cada criativo deve ter funcao no teste e texto curto. Nao use logos de terceiros nem imagens enganosas.",
    schema: '{"visual_direction":"","brand_rules":[],"creatives":[{"name":"","purpose":"","format":"","aspect_ratio":"","concept":"","composition":"","on_art_text":"","visual_elements":[],"generation_prompt":"","variants":[]}],"production_checklist":[]}',
    requiresApproval: true,
    stage: 40,
  },
  {
    key: "social_media",
    title: "Plano e posts para Instagram",
    brief: "Criar um calendario editorial de 30 dias ligado a todas as etapas do funil.",
    mission: "Voce e um SOCIAL MEDIA senior para SaaS B2B. Crie um calendario editorial de 30 dias, pratico para um fundador solo, com frequencia de tres posts por semana. Distribua aproximadamente 50 por cento educacao, 20 por cento conexao, 15 por cento engajamento e 15 por cento venda. Ligue cada post a uma etapa do funil e alterne carrossel e post unico. Nos posts de conversao, use apenas acao iniciada pelo usuario: responder Story, enviar DM ou acessar o link da bio. Nunca proponha DM fria automatica. Quando houver interesse, o proximo canal e o WhatsApp, sem reuniao. Entregue hook, legenda, hashtags especificas, CTA, roteiro visual e data sugerida. O conteudo sempre passa por aprovacao antes de publicar.",
    schema: '{"monthly_strategy":"","content_mix":{"education":50,"connection":20,"engagement":15,"sales":15},"cadence":"3 posts por semana","weekly_focus":[{"week":1,"objective":"","funnel_stage":""}],"posts":[{"day_offset":1,"objective":"education|connection|engagement|conversion","funnel_stage":"","format":"single|carousel","pillar":"","theme":"","hook":"","caption":"","hashtags":[],"cta":"","conversation_trigger":"none|story_reply|inbound_dm|bio_link","instagram_entry_reply":"","whatsapp_handoff":"","alt_text":"","visual_brief":"","slides":[{"title":"","body":""}]}],"daily_stories":[],"community_actions":[]}',
    requiresApproval: true,
    stage: 50,
  },
  {
    key: "sdr",
    title: "Playbook de prospeccao SDR",
    brief: "Definir ICP, filtros, qualificacao e sequencia de primeiro contato para leads da Zuno.",
    mission: "Voce e um SDR senior de vendas consultivas B2B. Crie criterios para a Zuno encontrar e priorizar oportunidades e uma sequencia curta, contextual e respeitosa. A API oficial do Instagram nao deve iniciar DM fria para perfis arbitrarios: automatize apenas respostas a DM, mencao, Story ou comentario permitido. A transferencia para WhatsApp acontece por link e somente depois da acao do usuario. No WhatsApp, confirme contexto, consentimento e qualificacao. Nao proponha reuniao. Nunca oriente simulacao de comportamento humano, disparo em massa ou evasao de bloqueios.",
    schema: '{"icp":{"segments":[],"company_signals":[],"decision_maker_roles":[],"disqualifiers":[]},"sourcing_filters":[{"niche":"","locations":[],"signals":[]}],"instagram_entry_playbook":[{"trigger":"","reply":"","stop_condition":""}],"whatsapp_handoff":{"qualification_signal":"","link_message":"","prefilled_text":"","opt_in_record":""},"qualification_questions":[],"whatsapp_sequence":[{"step":1,"goal":"","message":"","stop_condition":""}],"handoff_to_closer":[],"compliance_rules":[]}',
    requiresApproval: true,
    stage: 60,
  },
  {
    key: "closer",
    title: "Roteiro de vendas e fechamento",
    brief: "Preparar diagnostico, demonstracao, objecoes e proximos passos para conversas qualificadas.",
    mission: "Voce e um CLOSER senior de SaaS B2B consultivo. Conduza toda a venda de forma assincrona no WhatsApp: entender contexto, diagnosticar, demonstrar apenas o que a Zuno realmente faz, responder objecoes, recomendar plano e enviar o link correto do site para cadastro ou pagamento. Nao proponha reuniao, chamada ou agenda. Se a automacao nao resolver, ofereca falar com Jeferson no mesmo WhatsApp. Nao ofereca descontos ou garantias que nao foram informados.",
    schema: '{"whatsapp_opening":"","discovery_questions":[],"async_demo_flow":[{"step":"","purpose":"","message":"","asset_or_link":""}],"qualification_scorecard":[],"objection_handling":[{"objection":"","diagnosis_question":"","response":"","next_step":""}],"plan_recommendation_rules":[],"checkout_handoff":{"message":"","site_link":"","success_event":""},"human_handoff_message":"","follow_up_templates":[]}',
    requiresApproval: true,
    stage: 70,
  },
  {
    key: "performance_analyst",
    title: "Mensuracao e regras de decisao",
    brief: "Definir eventos, painel minimo e ritual de melhoria sem fabricar previsoes.",
    mission: "Voce e um ANALISTA DE PERFORMANCE senior. Crie um plano de mensuracao proporcional ao piloto e aos dados disponiveis. A verba informada se refere somente a anuncios pagos. Diferencie metrica de diagnostico de resultado de negocio. Nao invente benchmarks. Se nao houver dados reais, declare que a linha de base sera criada pelo teste.",
    schema: '{"north_star":"","funnel_metrics":[{"stage":"","event":"","metric":"","source":""}],"dashboard_cards":[],"baseline_plan":[],"decision_cadence":"","decision_rules":[{"signal":"","interpretation":"","action":""}],"data_quality_checks":[],"risks":[],"first_report_questions":[]}',
    requiresApproval: false,
    stage: 80,
  },
];

const contextSources: Record<string, string[]> = {
  marketing_director: [],
  traffic_manager: ["marketing_director"],
  copywriter: ["marketing_director", "traffic_manager"],
  creative_director: ["marketing_director", "traffic_manager", "copywriter"],
  social_media: ["marketing_director", "copywriter", "creative_director"],
  sdr: ["marketing_director", "copywriter", "social_media"],
  closer: ["marketing_director", "copywriter", "sdr"],
  performance_analyst: [
    "marketing_director", "traffic_manager", "copywriter", "creative_director", "social_media", "sdr", "closer",
  ],
};

const handoffFields: Record<string, string[]> = {
  marketing_director: ["executive_summary", "positioning", "primary_goal", "offer_strategy", "audience_hypotheses", "priorities_next_7_days", "success_criteria"],
  traffic_manager: ["objective", "recommended_channel", "budget", "campaign_structure", "audiences", "optimization_event", "tests", "stop_rules", "scale_rules", "utm_pattern"],
  copywriter: ["message_strategy", "objections", "organic_ctas", "ads", "landing_page", "copy_guardrails"],
  creative_director: ["visual_direction", "brand_rules", "creatives", "production_checklist"],
  social_media: ["monthly_strategy", "content_mix", "cadence", "weekly_focus", "posts", "community_actions"],
  sdr: ["icp", "sourcing_filters", "instagram_entry_playbook", "whatsapp_handoff", "qualification_questions", "whatsapp_sequence", "handoff_to_closer", "compliance_rules"],
  closer: ["whatsapp_opening", "discovery_questions", "async_demo_flow", "qualification_scorecard", "objection_handling", "plan_recommendation_rules", "checkout_handoff", "human_handoff_message"],
  performance_analyst: ["north_star", "funnel_metrics", "dashboard_cards", "baseline_plan", "decision_cadence", "decision_rules", "data_quality_checks", "risks"],
};

function compactContext(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 1600);
  if (depth >= 4) return Array.isArray(value) ? `[${value.length} itens]` : "[detalhe compactado]";
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => compactContext(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Json).slice(0, 20)
        .map(([key, item]) => [key, compactContext(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 800);
}

function buildRelevantHandoffs(agentKey: string, tasks: Json[]) {
  const allowedSources = new Set(contextSources[agentKey] || []);
  return tasks
    .filter((item) => allowedSources.has(String(item.agent_key || "")))
    .slice(agentKey === "performance_analyst" ? -7 : -4)
    .map((item) => {
      const sourceKey = String(item.agent_key || "");
      const output = item.output && typeof item.output === "object" ? item.output as Json : {};
      const selected: Json = {};
      for (const field of handoffFields[sourceKey] || []) {
        if (output[field] !== undefined) selected[field] = compactContext(output[field]);
      }
      if (sourceKey === "marketing_director" && output.handoffs && typeof output.handoffs === "object") {
        const handoffs = output.handoffs as Json;
        if (handoffs[agentKey] !== undefined) selected.handoff_for_this_agent = compactContext(handoffs[agentKey]);
      }
      return {
        agent_key: sourceKey,
        title: safeText(item.title),
        decisions_and_assets: selected,
      };
    });
}

function reply(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 8000);
}

function parseJson(text: string): Json {
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA nao retornou JSON valido.");
  return JSON.parse(clean.slice(start, end + 1));
}

async function gemini(prompt: string, key: string): Promise<Json> {
  const model = Deno.env.get("MARKETING_TEAM_MODEL") || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        model + ":generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 10000,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Gemini falhou (" + response.status + "): " +
        (await response.text()).slice(0, 500));
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "").join("") || "";
    return parseJson(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticate(req: Request, admin: SupabaseClient) {
  const configuredCron = Deno.env.get("MARKETING_CRON_SECRET") || "";
  const suppliedCron = req.headers.get("x-cron-secret") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("Authorization") || "";
  if (service && authorization === "Bearer " + service) {
    return { isCron: false, isInternal: true, user: null };
  }

  if (configuredCron && suppliedCron && suppliedCron === configuredCron) {
    return { isCron: true, isInternal: false, user: null };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth, error } = await userClient.auth.getUser();
  if (error || !auth.user) throw new Error("UNAUTHORIZED:Sessao invalida.");
  const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: auth.user.id });
  const allowed = adminFlag === true ||
    adminEmails.has(String(auth.user.email || "").trim().toLowerCase());
  if (!allowed) throw new Error("FORBIDDEN:Acesso exclusivo para administradores.");
  return { isCron: false, isInternal: false, user: auth.user };
}

async function createCampaign(admin: SupabaseClient, userId: string, input: Json) {
  const { data: settings, error: settingsError } = await admin
    .from("marketing_settings").select("*").eq("singleton", true).single();
  if (settingsError) throw new Error("Configuracoes de marketing indisponiveis: " + settingsError.message);

  const hasDailyBudget = input.paid_media_daily_budget !== undefined || input.daily_budget !== undefined;
  const requestedDailyInput = Number(input.paid_media_daily_budget ?? input.daily_budget ?? 0);
  const requestedMonthly = Number(
    input.paid_media_monthly_budget ?? input.monthly_budget ??
      (hasDailyBudget ? requestedDailyInput * 30 : settings.monthly_paid_media_cap ?? 0),
  );
  const monthlyCap = Number(settings.monthly_paid_media_cap ?? 0);
  const dailyCap = Number(settings.daily_paid_media_cap ?? 0);
  const explicitBudgetApproval = input.explicit_budget_approval === true;
  if (!Number.isFinite(requestedMonthly) || requestedMonthly < 0) {
    throw new Error("Orcamento mensal invalido.");
  }
  if (!Number.isFinite(requestedDailyInput) || requestedDailyInput < 0) {
    throw new Error("Orcamento diario invalido.");
  }
  if (requestedMonthly > monthlyCap && !explicitBudgetApproval) {
    throw new Error("A verba de midia paga excede o teto de R$ " + monthlyCap.toFixed(2) + ". Altere o teto conscientemente antes.");
  }
  if (hasDailyBudget && requestedDailyInput > dailyCap && !explicitBudgetApproval) {
    throw new Error("A verba diaria excede o teto de R$ " + dailyCap.toFixed(2) + ".");
  }
  const derivedDaily = requestedMonthly === 0 ? 0 : hasDailyBudget
    ? requestedDailyInput
    : Math.min(dailyCap, requestedMonthly / 30);

  const payload = {
    created_by: userId,
    name: safeText(input.name, "Piloto de aquisicao Zuno") || "Piloto de aquisicao Zuno",
    objective: safeText(input.objective, "Gerar testes gratis qualificados e as primeiras assinaturas."),
    offer: safeText(input.offer, settings.primary_offer),
    target_audience: safeText(input.target_audience, settings.default_audience),
    channels: Array.isArray(input.channels) && input.channels.length
      ? input.channels.map(String).slice(0, 6)
      : ["instagram", "meta_ads", "whatsapp"],
    paid_media_monthly_budget: requestedMonthly,
    paid_media_daily_budget: Number(derivedDaily.toFixed(2)),
    status: "planning",
    approval_status: "pending",
    next_action: "Gerar entregas do time de marketing.",
    metadata: {
      approval_mode: settings.approval_mode,
      guardrails: settings.guardrails,
      source: safeText(input.source, "admin_marketing_center"),
      director_instruction: safeText(input.director_instruction) || null,
      routed_agents: Array.isArray(input.agent_keys) ? input.agent_keys.map(String) : [],
      routing_plan: input.routing_plan && typeof input.routing_plan === "object" ? input.routing_plan : null,
      explicit_budget_approval: explicitBudgetApproval,
      planning_only: true,
    },
  };

  const { data: campaign, error } = await admin
    .from("marketing_campaigns").insert(payload).select("*").single();
  if (error) throw new Error("Falha ao criar campanha: " + error.message);

  const requestedAgentKeys = new Set(
    Array.isArray(input.agent_keys) ? input.agent_keys.map(String) : [],
  );
  const selectedAgents = requestedAgentKeys.size
    ? agents.filter((agent) => requestedAgentKeys.has(agent.key))
    : agents;
  const routedTaskEntries = Array.isArray(input.routed_tasks)
    ? input.routed_tasks.filter((item) => item && typeof item === "object") as Json[]
    : [];
  const routedTaskByAgent = new Map(
    routedTaskEntries.map((item) => [safeText(item.agent_key), item]),
  );
  const tasks = selectedAgents.map((agent) => {
    const taskPlan = routedTaskByAgent.get(agent.key);
    const dependsOn = Array.isArray(taskPlan?.depends_on) ? taskPlan.depends_on.map(String) : [];
    const criteria = Array.isArray(taskPlan?.acceptance_criteria)
      ? taskPlan.acceptance_criteria.map(String)
      : [];
    const specialistBrief = safeText(taskPlan?.brief, agent.brief);
    const context = [
      "Ordem do fundador: " + safeText(input.director_instruction, safeText(input.objective)),
      safeText(taskPlan?.expected_output) ? "Entregavel esperado: " + safeText(taskPlan?.expected_output) : "",
      criteria.length ? "Criterios de aceite: " + criteria.join(" | ") : "",
      dependsOn.length ? "Depende de: " + dependsOn.join(", ") : "",
    ].filter(Boolean).join("\n");
    return {
      campaign_id: campaign.id,
      agent_key: agent.key,
      stage_order: agent.stage,
      title: safeText(taskPlan?.title, agent.title),
      brief: specialistBrief + "\n\n" + context,
      status: "queued",
      requires_approval: agent.requiresApproval || taskPlan?.requires_approval === true,
    };
  });
  const { error: taskError } = await admin.from("marketing_tasks").insert(tasks);
  if (taskError) throw new Error("Campanha criada, mas as tarefas falharam: " + taskError.message);
  return campaign;
}

async function selectNextTask(admin: SupabaseClient, campaignId?: string) {
  let query = admin.from("marketing_tasks")
    .select("*, marketing_campaigns!inner(status)")
    .eq("status", "queued").in("marketing_campaigns.status", ["planning", "generating"])
    .order("created_at", { ascending: true }).order("stage_order", { ascending: true }).limit(1);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Falha ao localizar proxima tarefa: " + error.message);
  return data;
}

async function runNextTask(admin: SupabaseClient, aiKey: string, campaignId?: string) {
  const task = await selectNextTask(admin, campaignId);
  if (!task) {
    return { done: true, task: null };
  }
  const agent = agents.find((item) => item.key === task.agent_key);
  if (!agent) throw new Error("Agente desconhecido: " + task.agent_key);

  const { data: claimed, error: claimError } = await admin
    .from("marketing_tasks")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", task.id).eq("status", "queued").select("*").maybeSingle();
  if (claimError) throw new Error("Falha ao iniciar tarefa: " + claimError.message);
  if (!claimed) return { done: false, skipped: true, task: null };

  const [{ data: campaign, error: campaignError }, { data: settings }, { data: contextTasks }] = await Promise.all([
    admin.from("marketing_campaigns").select("*").eq("id", task.campaign_id).single(),
    admin.from("marketing_settings").select("*").eq("singleton", true).single(),
    admin.from("marketing_tasks").select("agent_key,title,output,status")
      .eq("campaign_id", task.campaign_id)
      .in("status", ["completed", "pending_approval", "approved"])
      .lt("stage_order", task.stage_order).order("stage_order", { ascending: true }),
  ]);
  if (campaignError) throw new Error("Campanha nao encontrada: " + campaignError.message);

  await admin.from("marketing_campaigns").update({
    status: "generating",
    next_action: "Agente em execucao: " + agent.title,
  }).eq("id", campaign.id);

  const model = Deno.env.get("MARKETING_TEAM_MODEL") || "gemini-2.5-flash";
  const relevantHandoffs = buildRelevantHandoffs(agent.key, (contextTasks || []) as Json[]);
  const runInput = {
    assignment: {
      specialist: agent.title,
      task_title: safeText(task.title, agent.title),
      task_brief: safeText(task.brief, agent.brief),
      approval_required: task.requires_approval === true,
    },
    campaign: {
      name: campaign.name,
      objective: campaign.objective,
      offer: campaign.offer,
      target_audience: campaign.target_audience,
      channels: campaign.channels,
      paid_media_monthly_budget: campaign.paid_media_monthly_budget,
      paid_media_daily_budget: campaign.paid_media_daily_budget,
      metrics_snapshot: campaign.metrics_snapshot,
    },
    company: {
      name: settings?.company_name || "Zuno Propect",
      product_context: settings?.product_context || "",
      brand_voice: settings?.brand_voice || "",
      guardrails: settings?.guardrails || {},
    },
    relevant_handoffs: relevantHandoffs,
    context_policy: "Somente handoffs necessarios para esta especialidade foram incluidos.",
  };

  const { data: run, error: runError } = await admin.from("marketing_agent_runs").insert({
    campaign_id: campaign.id,
    task_id: task.id,
    agent_key: agent.key,
    status: "started",
    model,
    input_snapshot: runInput,
  }).select("id").single();
  if (runError) throw new Error("Falha ao registrar execucao: " + runError.message);

  try {
    const context = JSON.stringify(runInput, null, 2).slice(0, 32000);
    const output = await gemini([
      agent.mission,
      "\nPLAYBOOK OPERACIONAL ADAPTADO PARA A ZUNO:\n" + getMarketingPlaybook(agent.key),
      "\nCONTEXTO REAL DA ZUNO E DA CAMPANHA:\n" + context,
      "\nA ORDEM INDIVIDUAL EM assignment E A SUA PRIORIDADE. Use os handoffs apenas como contexto e nao refaca o trabalho de outro especialista.",
      "Resolva em uma unica passagem: diagnostique, decida, produza, audite e corrija silenciosamente antes do JSON final.",
      "\nREGRAS INEGOCIAVEIS:",
      "- Trabalhe somente com os fatos do contexto. Quando faltar evidencia, sinalize a validacao necessaria.",
      "- O teto financeiro vale exclusivamente para compra de midia paga. Ele nao limita agentes, conteudo organico, prospeccao ou uso das ferramentas da Zuno.",
      "- Respeite os tetos de midia paga; nao publique anuncios, envie mensagem, altere investimento ou afirme que executou integracoes.",
      "- Separe hipotese de fato. Nao prometa vendas, leads, CPL ou retorno.",
      "- Entregue material pratico em portugues do Brasil.",
      "- Nao preencha campos com texto generico para parecer completo. Use vazio quando nao se aplicar e seja especifico quando se aplicar.",
      "- Verifique consistencia entre objetivo, publico, oferta, canal, verba, CTA, metrica e proximo passo.",
      "- Nao exponha raciocinio interno, rascunhos ou autocritica; entregue somente a versao final corrigida.",
      "- Retorne somente JSON valido seguindo exatamente esta estrutura-base:\n" + agent.schema,
    ].join("\n"), aiKey);

    const finalStatus = task.requires_approval === true ? "pending_approval" : "completed";
    const now = new Date().toISOString();
    const { error: completeError } = await admin.from("marketing_tasks").update({
      status: finalStatus,
      output,
      completed_at: now,
      error_message: null,
    }).eq("id", task.id);
    if (completeError) throw new Error("Falha ao salvar entrega: " + completeError.message);
    await admin.from("marketing_agent_runs").update({
      status: "completed",
      output_snapshot: output,
      completed_at: now,
    }).eq("id", run.id);

    const next = await selectNextTask(admin, campaign.id);
    if (!next) {
      const directorTask = (contextTasks || []).find(
        (item: Json) => item.agent_key === "marketing_director",
      ) as Json | undefined;
      const directorOutput = directorTask?.output as Json | undefined;
      const summary = directorOutput?.executive_summary || directorTask?.output;
      await admin.from("marketing_campaigns").update({
        status: "pending_approval",
        orchestrator_summary: safeText(
          summary || "O time concluiu as entregas e aguarda aprovacao.",
        ).slice(0, 2000),
        next_action: "Revisar e aprovar as entregas antes de qualquer execucao externa.",
      }).eq("id", campaign.id);
      await admin.from("marketing_approvals").insert({
        campaign_id: campaign.id,
        approval_type: "campaign_execution",
        status: "pending",
        requested_by: campaign.created_by,
      });
    }
    return { done: !next, task: { ...task, status: finalStatus, output }, next_agent: next?.agent_key || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("marketing_tasks").update({ status: "failed", error_message: message, completed_at: now }).eq("id", task.id),
      admin.from("marketing_agent_runs").update({ status: "failed", error_message: message, completed_at: now }).eq("id", run.id),
      admin.from("marketing_campaigns").update({ status: "failed", next_action: "Repetir a tarefa que falhou." }).eq("id", campaign.id),
    ]);
    throw error;
  }
}

function keepBackgroundAlive(promise: Promise<unknown>) {
  EdgeRuntime.waitUntil(promise);
}

async function requestNextBackgroundStep(url: string, service: string, campaignId: string) {
  const response = await fetch(url + "/functions/v1/marketing-orchestrator", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + service,
      apikey: service,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "run_background", campaign_id: campaignId }),
  });
  if (!response.ok) {
    throw new Error("Falha ao encadear a proxima etapa em segundo plano: " + response.status);
  }
}

async function processCampaignInBackground(
  admin: SupabaseClient,
  aiKey: string,
  url: string,
  service: string,
  campaignId: string,
) {
  try {
    const result = await runNextTask(admin, aiKey, campaignId);
    if (!result.done) {
      await requestNextBackgroundStep(url, service, campaignId);
    }
  } catch (error) {
    console.error("[marketing-background]", error);
  }
}
async function approveTask(admin: SupabaseClient, taskId: string, userId: string, notes: string) {
  const { data: task, error } = await admin.from("marketing_tasks")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      reviewer_notes: notes || null,
    })
    .eq("id", taskId).eq("status", "pending_approval").select("*").single();
  if (error) throw new Error("Nao foi possivel aprovar a entrega: " + error.message);
  return task;
}

async function approveCampaign(admin: SupabaseClient, campaignId: string, userId: string) {
  const now = new Date().toISOString();
  const { data: campaign, error } = await admin.from("marketing_campaigns").update({
    status: "approved",
    approval_status: "approved",
    approved_at: now,
    approved_by: userId,
    next_action: "Produzir criativos e conectar os canais oficiais para iniciar a execucao.",
  }).eq("id", campaignId).eq("status", "pending_approval").select("*").single();
  if (error) throw new Error("Nao foi possivel aprovar a campanha: " + error.message);
  await Promise.all([
    admin.from("marketing_tasks").update({ status: "approved", approved_at: now, approved_by: userId })
      .eq("campaign_id", campaignId).eq("status", "pending_approval"),
    admin.from("marketing_approvals").update({ status: "approved", resolved_by: userId, resolved_at: now })
      .eq("campaign_id", campaignId).eq("status", "pending"),
  ]);
  return campaign;
}

async function retryTask(admin: SupabaseClient, taskId: string) {
  const { data: task, error } = await admin.from("marketing_tasks").update({
    status: "queued",
    error_message: null,
    output: {},
    started_at: null,
    completed_at: null,
  }).eq("id", taskId).in("status", ["failed", "rejected"]).select("*").single();
  if (error) throw new Error("Nao foi possivel recolocar a tarefa na fila: " + error.message);
  await admin.from("marketing_campaigns").update({ status: "generating", next_action: "Executar novamente " + task.title + "." })
    .eq("id", task.campaign_id);
  return task;
}

function saoPauloDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));
}

function allowedAgentKeys(value: unknown) {
  const allowed = new Set(agents.map((agent) => agent.key));
  return Array.isArray(value)
    ? value.map(String).filter((key) => allowed.has(key))
    : [];
}

async function directorCommand(
  admin: SupabaseClient,
  aiKey: string,
  userId: string,
  input: Json,
  url: string,
  service: string,
) {
  const instruction = safeText(input.instruction ?? input.command ?? input.objective);
  if (instruction.length < 8) throw new Error("Descreva com mais detalhes o que o Diretor deve fazer.");

  const duplicateWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentCampaigns } = await admin.from("marketing_campaigns")
    .select("id,name,status,approval_status,created_at,metadata")
    .gte("created_at", duplicateWindow)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(12);
  const duplicate = ((recentCampaigns || []) as Json[]).find((item) => {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as Json : {};
    return safeText(metadata.director_instruction).toLocaleLowerCase("pt-BR") === instruction.toLocaleLowerCase("pt-BR");
  });
  if (duplicate) {
    const metadata = duplicate.metadata && typeof duplicate.metadata === "object" ? duplicate.metadata as Json : {};
    const routingPlan = metadata.routing_plan && typeof metadata.routing_plan === "object" ? metadata.routing_plan as Json : {};
    const route = safeText(routingPlan.route, "general_marketing");
    const routedAgents = allowedAgentKeys(metadata.routed_agents);
    return {
      route,
      summary: "Esse pedido identico ja foi distribuido recentemente. Reaproveitei o trabalho em andamento para nao gastar tokens em duplicidade.",
      agents: routedAgents,
      campaign: duplicate,
      accepted: true,
      reused: true,
      planning_only: true,
      meta_connection_required: route === "paid_campaign",
    };
  }

  const specialistCatalog = agents.map((agent) => ({
    key: agent.key,
    title: agent.title,
    responsibility: agent.brief,
    requires_approval: agent.requiresApproval,
    execution_order: agent.stage,
  }));
  const routing = await gemini([
    "Voce e o Diretor central e orquestrador operacional da Zuno.",
    "Sua funcao e transformar a ordem do fundador em um plano claro e encaminhar cada parte ao especialista correto.",
    "Leia objetivo, contexto, publico, prazo, verba, riscos e dependencias. Nao invente informacoes ausentes.",
    "Selecione o menor time suficiente entre os especialistas cadastrados. Novos especialistas do catalogo tambem podem ser usados.",
    "Cada tarefa precisa de um briefing exclusivo, entregavel esperado, dependencias e criterios objetivos de aceite.",
    "Gasto, publicacao, disparo, contato externo e alteracoes irreversiveis sempre exigem aprovacao humana.",
    "Programacao, alteracao de produto, banco ou deploy exigem Codex: marque requires_codex e nao finja que o time de marketing executou.",
    "Se faltar uma decisao que muda materialmente o resultado, marque needs_clarification e formule uma unica pergunta estrategica.",
    "Use instagram_revision para alterar ou revisar post existente; paid_campaign para anuncios; organic_campaign para conteudo; sales_operation para SDR, WhatsApp ou vendas; product_development para produto e codigo; general_marketing nos demais casos.",
    "ESPECIALISTAS DISPONIVEIS: " + JSON.stringify(specialistCatalog),
    "ORDEM DO FUNDADOR: " + instruction,
    "Retorne somente JSON no esquema:",
    '{"route":"instagram_revision|paid_campaign|organic_campaign|sales_operation|general_marketing|product_development","summary":"","daily_budget":0,"monthly_budget":0,"keyword":"","audience":"","requires_codex":false,"needs_clarification":false,"clarifying_question":"","agent_keys":[],"tasks":[{"agent_key":"","title":"","brief":"","depends_on":[],"expected_output":"","acceptance_criteria":[],"requires_approval":true}],"director_return_format":""}',
  ].join("\n"), aiKey);

  const validRoutes = new Set([
    "instagram_revision",
    "paid_campaign",
    "organic_campaign",
    "sales_operation",
    "general_marketing",
    "product_development",
  ]);
  const requestedRoute = safeText(routing.route, "general_marketing");
  const route = validRoutes.has(requestedRoute) ? requestedRoute : "general_marketing";
  const summary = safeText(routing.summary, instruction);

  if (routing.needs_clarification === true) {
    return {
      route,
      summary,
      agents: allowedAgentKeys(routing.agent_keys),
      needs_clarification: true,
      clarifying_question: safeText(routing.clarifying_question, "Qual decisao principal devo considerar antes de distribuir este trabalho?"),
      accepted: false,
    };
  }

  if (routing.requires_codex === true || route === "product_development") {
    return {
      route: "product_development",
      summary,
      agents: allowedAgentKeys(routing.agent_keys),
      requires_codex: true,

      accepted: false,
      director_return_format: safeText(routing.director_return_format),
    };
  }
  if (route === "instagram_revision") {
    let post: Json | null = null;
    const targetId = safeText(input.target_post_id);
    if (targetId) {
      const result = await admin.from("instagram_content_posts").select("*").eq("id", targetId).single();
      if (result.error) throw new Error("Post indicado nao encontrado: " + result.error.message);
      post = result.data as Json;
    } else {
      const result = await admin.from("instagram_content_posts").select("*")
        .not("scheduled_at", "is", null).order("scheduled_at", { ascending: true }).limit(100);
      if (result.error) throw new Error("Calendario indisponivel: " + result.error.message);
      const rows = (result.data || []) as Json[];
      const today = saoPauloDay(new Date());
      post = rows.find((item) => item.scheduled_at && saoPauloDay(String(item.scheduled_at)) === today && item.status !== "published") ||
        rows.find((item) => item.status === "pending_review" && new Date(String(item.scheduled_at)).getTime() >= Date.now()) ||
        rows.find((item) => item.status === "pending_review") || null;
    }
    if (!post) throw new Error("Nao encontrei um post pendente no calendario para alterar.");

    const revision = await gemini([
      "Voce representa um squad com Social Media senior, Copywriter senior e Diretor de Arte da Zuno.",
      "Revise o MESMO post conforme a ordem do fundador. Preserve scheduled_at e nao publique.",
      "A marca e um SaaS B2B premium, escuro, verde e branco. Nao invente provas, clientes, numeros ou funcionalidades.",
      "Se a ordem pedir mudanca de design, ajuste hook, slides, texto na arte e visual_brief de forma coerente.",
      "POST ATUAL:", JSON.stringify(post),
      "ORDEM DO FUNDADOR:", instruction,
      "Retorne somente JSON:",
      '{"post":{"objective":"","format":"single|carousel","pillar":"","theme":"","target_audience":"","hook":"","caption":"","hashtags":[],"cta":"","alt_text":"","visual_brief":"","slides":[{"title":"","body":""}]},"director_summary":""}',
    ].join("\n"), aiKey);
    const candidate = (revision.post && typeof revision.post === "object" ? revision.post : revision) as Json;
    const format = candidate.format === "carousel" ? "carousel" : candidate.format === "single" ? "single" : post.format;
    const updatedValues = {
      objective: safeText(candidate.objective, String(post.objective || "awareness")),
      format,
      pillar: safeText(candidate.pillar, String(post.pillar || "")) || null,
      theme: safeText(candidate.theme, String(post.theme || "Conteudo Zuno")),
      target_audience: safeText(candidate.target_audience, String(post.target_audience || "")) || null,
      hook: safeText(candidate.hook, String(post.hook || "")),
      caption: safeText(candidate.caption, String(post.caption || "")),
      hashtags: normalizeHashtags(candidate.hashtags ?? post.hashtags),
      cta: safeText(candidate.cta, String(post.cta || "")) || null,
      alt_text: safeText(candidate.alt_text, String(post.alt_text || "")) || null,
      visual_brief: safeText(candidate.visual_brief, String(post.visual_brief || "")) || null,
      slides: Array.isArray(candidate.slides) ? candidate.slides.slice(0, 8) : post.slides,
      media_url: null,
      media_urls: [],
      status: "pending_review",
      approved_at: null,
      approved_by: null,
      last_error: null,
      metadata: {
        ...((post.metadata && typeof post.metadata === "object") ? post.metadata as Json : {}),
        director_revision: { instruction, revised_at: new Date().toISOString(), agents: ["social_media", "copywriter", "creative_director"] },
      },
      agent_trace: {
        ...((post.agent_trace && typeof post.agent_trace === "object") ? post.agent_trace as Json : {}),
        director_revision: { instruction, model: Deno.env.get("MARKETING_TEAM_MODEL") || "gemini-2.5-flash" },
      },
    };
    const result = await admin.from("instagram_content_posts").update(updatedValues)
      .eq("id", String(post.id)).select("*").single();
    if (result.error) throw new Error("Nao foi possivel salvar a revisao: " + result.error.message);
    return {
      route,
      summary: safeText(revision.director_summary, "Social Media, Copy e Design revisaram o post. A nova versao aguarda sua aprovacao."),
      agents: ["social_media", "copywriter", "creative_director"],
      post: result.data,
      needs_artwork: true,
    };
  }

  const routeAgents: Record<string, string[]> = {
    paid_campaign: ["marketing_director", "traffic_manager", "copywriter", "creative_director", "performance_analyst"],
    organic_campaign: ["marketing_director", "copywriter", "creative_director", "social_media", "performance_analyst"],
    sales_operation: ["marketing_director", "copywriter", "sdr", "closer", "performance_analyst"],
    general_marketing: ["marketing_director"],
  };
  const routed = allowedAgentKeys(routing.agent_keys);
  const routedTaskCandidates = (Array.isArray(routing.tasks) ? routing.tasks as Json[] : [])
    .filter((task) => task && typeof task === "object" && allowedAgentKeys([task.agent_key]).length > 0);
  const taskAgentKeys = allowedAgentKeys(routedTaskCandidates.map((task) => task.agent_key));
  const agentKeys = Array.from(new Set([
    "marketing_director", ...(routeAgents[route] || routeAgents.general_marketing), ...routed, ...taskAgentKeys,
  ]));
  const routedTasks = routedTaskCandidates
    .filter((task) => agentKeys.includes(safeText(task.agent_key)));

  const dailyBudget = Math.max(0, Number(routing.daily_budget || 0));
  const monthlyBudget = Math.max(0, Number(routing.monthly_budget || dailyBudget * 30));
  const campaign = await createCampaign(admin, userId, {
    name: "Diretor - " + summary.slice(0, 90),
    objective: instruction,
    offer: input.offer,
    target_audience: safeText(routing.audience) || input.target_audience,
    channels: route === "paid_campaign" ? ["meta_ads", "instagram", "website"] : ["instagram", "whatsapp", "website"],
    paid_media_daily_budget: dailyBudget,
    paid_media_monthly_budget: monthlyBudget,
    explicit_budget_approval: true,
    director_instruction: instruction,
    source: "zuno_director_command",
    agent_keys: agentKeys,
    routed_tasks: routedTasks,
    routing_plan: {
      route,
      summary,
      keyword: safeText(routing.keyword) || null,
      audience: safeText(routing.audience) || null,
      director_return_format: safeText(routing.director_return_format) || null,
    },
  });
  keepBackgroundAlive(processCampaignInBackground(admin, aiKey, url, service, String(campaign.id)));
  return {
    route,
    summary,
    agents: agentKeys,
    campaign,
    tasks: routedTasks,
    accepted: true,
    planning_only: true,
    meta_connection_required: route === "paid_campaign",
  };
}

function normalizeHashtags(value: unknown) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  return Array.from(new Set(list.map(String).map((item) => item.trim()).filter(Boolean)
    .map((item) => item.startsWith("#") ? item : "#" + item))).slice(0, 12);
}

async function sendSocialToInstagram(admin: SupabaseClient, taskId: string, userId: string) {
  const { data: task, error } = await admin.from("marketing_tasks").select("*, marketing_campaigns(*)")
    .eq("id", taskId).eq("agent_key", "social_media").eq("status", "approved").single();
  if (error) throw new Error("A entrega de social media precisa estar aprovada: " + error.message);
  const output = task.output as Json;
  const posts = Array.isArray(output?.posts) ? output.posts as Json[] : [];
  if (!posts.length) throw new Error("O agente de social media nao entregou posts validos.");

  const { data: existing } = await admin.from("instagram_content_posts").select("id")
    .contains("metadata", { marketing_task_id: taskId }).limit(1);
  if (existing?.length) return { posts: [], already_sent: true };

  const batchId = crypto.randomUUID();
  const campaign = task.marketing_campaigns as Json;
  const rows = posts.slice(0, 7).map((post, index) => ({
    batch_id: batchId,
    created_by: userId,
    status: "pending_review",
    objective: safeText(post.objective, "awareness"),
    format: post.format === "carousel" ? "carousel" : "single",
    pillar: safeText(post.pillar, "Prospeccao B2B"),
    theme: safeText(post.theme, safeText(campaign.name, "Zuno Propect")),
    target_audience: safeText(campaign.target_audience),
    hook: safeText(post.hook),
    caption: safeText(post.caption),
    hashtags: normalizeHashtags(post.hashtags),
    cta: safeText(post.cta, "Teste a Zuno Propect."),
    alt_text: safeText(post.alt_text, "Conteudo da Zuno Propect sobre prospeccao B2B."),
    visual_brief: safeText(post.visual_brief),
    slides: Array.isArray(post.slides) ? post.slides.slice(0, 8) : [],
    agent_trace: { source: "marketing_team", social_media: post },
    metadata: {
      marketing_campaign_id: task.campaign_id,
      marketing_task_id: taskId,
      day_offset: Number(post.day_offset || index + 1),
    },
  }));
  const { data: inserted, error: insertError } = await admin.from("instagram_content_posts")
    .insert(rows).select("*");
  if (insertError) throw new Error("Falha ao enviar posts para o Instagram: " + insertError.message);
  return { posts: inserted || [], already_sent: false, batch_id: batchId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ success: false, error: "Metodo nao permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const aiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini_API");
    if (!url || !service || !anon) throw new Error("Supabase nao configurado.");
    const admin = createClient(url, service);
    const auth = await authenticate(req, admin);
    const input = await req.json().catch(() => ({})) as Json;
    const action = safeText(input.action, "run_next");

    if (auth.isCron && !["run_next"].includes(action)) {
      return reply({ success: false, error: "Acao nao permitida para o agendador." }, 403);
    }

    if (auth.isInternal && action !== "run_background") {
      return reply({ success: false, error: "Acao interna nao permitida." }, 403);
    }
    if (action === "create_campaign") {
    if (action === "director_command") {
      if (!auth.user) throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      if (!aiKey) throw new Error("GOOGLE_GEMINI_API_KEY nao configurada.");
      const result = await directorCommand(admin, aiKey, auth.user.id, input, url, service);
      return reply({ success: true, ...result });
    }

      if (!auth.user) throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      const campaign = await createCampaign(admin, auth.user.id, input);
      return reply({ success: true, campaign, agents: agents.map(({ key, title, stage }) => ({ key, title, stage })) });
    }
    if (action === "run_next") {
    if (action === "run_campaign_async" || action === "run_background") {
      if (action === "run_campaign_async" && !auth.user) {
        throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      }
      if (action === "run_background" && !auth.isInternal) {
        throw new Error("FORBIDDEN:Acao exclusiva do processador interno.");
      }
      if (!aiKey) throw new Error("GOOGLE_GEMINI_API_KEY nao configurada.");
      const campaignId = safeText(input.campaign_id);
      if (!campaignId) throw new Error("Campanha obrigatoria.");
      keepBackgroundAlive(processCampaignInBackground(admin, aiKey, url, service, campaignId));
      return reply({ success: true, accepted: true, campaign_id: campaignId }, 202);
    }

      if (!aiKey) throw new Error("GOOGLE_GEMINI_API_KEY nao configurada.");
      const result = await runNextTask(admin, aiKey, safeText(input.campaign_id) || undefined);
      return reply({ success: true, ...result });
    }
    if (action === "approve_task") {
      if (!auth.user) throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      const task = await approveTask(admin, safeText(input.task_id), auth.user.id, safeText(input.notes));
      return reply({ success: true, task });
    }
    if (action === "approve_campaign") {
      if (!auth.user) throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      const campaign = await approveCampaign(admin, safeText(input.campaign_id), auth.user.id);
      return reply({ success: true, campaign });
    }
    if (action === "retry_task") {
      const task = await retryTask(admin, safeText(input.task_id));
      return reply({ success: true, task });
    }
    if (action === "send_social_to_instagram") {
      if (!auth.user) throw new Error("UNAUTHORIZED:Usuario obrigatorio.");
      const result = await sendSocialToInstagram(admin, safeText(input.task_id), auth.user.id);
      return reply({ success: true, ...result });
    }
    return reply({ success: false, error: "Acao desconhecida." }, 400);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const unauthorized = raw.startsWith("UNAUTHORIZED:");
    const forbidden = raw.startsWith("FORBIDDEN:");
    const message = raw.replace(/^(UNAUTHORIZED|FORBIDDEN):/, "");
    console.error("[marketing-orchestrator]", error);
    return reply({ success: false, error: message }, unauthorized ? 401 : forbidden ? 403 : 500);
  }
});
