/**
 * Script de Homologação Real do Postgres Local (Zuno Prospect RC-1)
 *
 * Pré-requisito: Docker Desktop iniciado no Windows + `npx supabase start`
 * Execução: node scripts/verify-local-supabase.mjs
 *
 * Trava de Segurança: Aborta imediatamente se a URL não for estritamente 127.0.0.1 ou localhost.
 */

import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:55321";
// Chave anon padrão do Supabase CLI local (demo/local-only)
const LOCAL_ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

if (
  (!LOCAL_URL.includes("127.0.0.1") && !LOCAL_URL.includes("localhost")) ||
  LOCAL_URL.includes("ihtltqxxlvbsxbiacbpr") ||
  LOCAL_URL.includes(".supabase.co")
) {
  console.error("BLOQUEIO DE SEGURANÇA: Este script só pode ser executado contra o Supabase local (127.0.0.1).");
  process.exit(1);
}

async function main() {
  console.log(`[1/6] Conectando ao Supabase local em ${LOCAL_URL}...`);
  const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const emailA = `user.a.${ts}@local.test`;
  const emailB = `user.b.${ts}@local.test`;
  const password = "TestPassword!2026";

  console.log(`[2/6] Criando dois usuários reais de teste no Auth local (${emailA} e ${emailB})...`);
  const { data: signUpA, error: errA } = await anonClient.auth.signUp({ email: emailA, password });
  if (errA || !signUpA.user || !signUpA.session) {
    throw new Error(`Falha ao criar User A no Auth local: ${errA?.message}`);
  }

  const { data: signUpB, error: errB } = await anonClient.auth.signUp({ email: emailB, password });
  if (errB || !signUpB.user || !signUpB.session) {
    throw new Error(`Falha ao criar User B no Auth local: ${errB?.message}`);
  }
  console.log(`      -> User A ID: ${signUpA.user.id}`);
  console.log(`      -> User B ID: ${signUpB.user.id}`);

  const clientA = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signUpA.session.access_token}` } },
    auth: { persistSession: false },
  });

  const clientB = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signUpB.session.access_token}` } },
    auth: { persistSession: false },
  });

  console.log("[3/6] Testando gravação legítima de seller_profiles (com commercial_maturity) e leads pelo Usuário A...");
  const { data: profileA, error: spErrA } = await clientA
    .from("seller_profiles")
    .upsert({
      user_id: signUpA.user.id,
      display_name: "Ana Vendedora",
      company_name: "Agência A Local",
      service_category: "automacao",
      service_offered: "Automação de WhatsApp",
      offer_description: "Triagem e agendamento via WhatsApp para clínicas.",
      target_audience: "Clínicas odontológicas e estéticas",
      commercial_maturity: "iniciante",
    })
    .select("user_id, display_name, company_name, service_category, commercial_maturity")
    .single();
  if (spErrA || !profileA) throw new Error(`Falha ao gravar seller_profiles (User A): ${spErrA?.message}`);
  console.log(`      -> seller_profiles gravado: ${JSON.stringify(profileA)}`);

  const { data: leadA, error: leadErrA } = await clientA
    .from("leads")
    .insert({
      user_id: signUpA.user.id,
      nome: "Clínica Local A",
      nicho: "Odontologia",
      cidade: "Curitiba",
      foco: "Automação",
      status: "novo",
    })
    .select("id, nome, user_id, foco, status")
    .single();
  if (leadErrA || !leadA) throw new Error(`Falha ao gravar lead (User A): ${leadErrA?.message}`);
  console.log(`      -> lead gravado: ${JSON.stringify(leadA)}`);

  console.log("[4/6] Testando isolamento RLS de LEITURA cruzada (Usuário B tentando ler dados do Usuário A)...");
  const { data: crossProfile } = await clientB
    .from("seller_profiles")
    .select("*")
    .eq("user_id", signUpA.user.id);
  if (crossProfile && crossProfile.length > 0) {
    throw new Error("VIOLAÇÃO RLS: Usuário B conseguiu ler seller_profiles do Usuário A!");
  }

  const { data: crossLead } = await clientB.from("leads").select("*").eq("id", leadA.id);
  if (crossLead && crossLead.length > 0) {
    throw new Error("VIOLAÇÃO RLS: Usuário B conseguiu ler lead do Usuário A!");
  }
  console.log("      -> Leitura cruzada bloqueada com sucesso (0 linhas retornadas para User B).");

  console.log("[5/6] Testando isolamento RLS de ESCRITA cruzada (Usuário B tentando atualizar/inserir em nome do Usuário A)...");
  const { data: hackedProfile } = await clientB
    .from("seller_profiles")
    .update({ company_name: "Invadido por B" })
    .eq("user_id", signUpA.user.id)
    .select("*");
  if (hackedProfile && hackedProfile.length > 0) {
    throw new Error("VIOLAÇÃO RLS: Usuário B conseguiu atualizar seller_profiles do Usuário A!");
  }

  const { error: forgedInsertErr } = await clientB.from("seller_profiles").insert({
    user_id: signUpA.user.id,
    company_name: "Falsificado por B",
  });
  if (!forgedInsertErr) {
    throw new Error("VIOLAÇÃO RLS: Usuário B conseguiu fazer INSERT em seller_profiles com user_id do Usuário A!");
  }

  const { data: hackedLead } = await clientB
    .from("leads")
    .update({ nome: "Lead Invadido por B" })
    .eq("id", leadA.id)
    .select("*");
  if (hackedLead && hackedLead.length > 0) {
    throw new Error("VIOLAÇÃO RLS: Usuário B conseguiu atualizar lead do Usuário A!");
  }
  console.log(`      -> Escrita cruzada bloqueada com sucesso (INSERT forjado rejeitado: "${forgedInsertErr.message}").`);

  console.log("[6/6] Testando bloqueio de acesso indevido ao SDR no banco (foco interno, status abertura_iniciada e [SDR WhatsApp])...");
  const { error: sdrFocusErr } = await clientB.from("leads").insert({
    user_id: signUpB.user.id,
    nome: "Lead Invasão Foco SDR",
    foco: "zuno_internal_prospecting",
  });
  if (!sdrFocusErr || !sdrFocusErr.message.includes("Acesso restrito")) {
    throw new Error(`FALHA DE TRIGGER SDR (foco): Inserção indevida não foi bloqueada (${sdrFocusErr?.message})`);
  }

  const { error: sdrStatusErr } = await clientB.from("leads").insert({
    user_id: signUpB.user.id,
    nome: "Lead Invasão Status SDR",
    foco: "Automação",
    status: "abertura_iniciada",
  });
  if (!sdrStatusErr || !sdrStatusErr.message.includes("Acesso restrito")) {
    throw new Error(`FALHA DE TRIGGER SDR (status abertura_iniciada): Inserção indevida não foi bloqueada (${sdrStatusErr?.message})`);
  }

  const { error: sdrNotesErr } = await clientB.from("leads").insert({
    user_id: signUpB.user.id,
    nome: "Lead Invasão Notas SDR",
    foco: "Automação",
    notas: "[SDR WhatsApp] Tentativa de forjar log SDR sem ser admin",
  });
  if (!sdrNotesErr || !sdrNotesErr.message.includes("Acesso restrito")) {
    throw new Error(`FALHA DE TRIGGER SDR (notas): Inserção indevida não foi bloqueada (${sdrNotesErr?.message})`);
  }
  console.log(`      -> Todos os 3 vetores SDR bloqueados no Postgres:`);
  console.log(`         1) foco:   "${sdrFocusErr.message}"`);
  console.log(`         2) status: "${sdrStatusErr.message}"`);
  console.log(`         3) notas:  "${sdrNotesErr.message}"`);

  console.log("\n✅ HOMOLOGAÇÃO REAL NO POSTGRES LOCAL CONCLUÍDA COM 100% DE SUCESSO!");
}

main().catch((err) => {
  console.error("\n❌ ERRO NA VERIFICAÇÃO LOCAL:", err.message);
  process.exit(1);
});
