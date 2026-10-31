/**
 * Script de Homologação Real do Postgres Local (Zuno Prospect RC-1)
 *
 * Pré-requisito: Docker Desktop iniciado no Windows + `npx supabase start`
 * Execução: node scripts/verify-local-supabase.mjs
 *
 * Trava de Segurança: Aborta imediatamente se a URL não for estritamente 127.0.0.1 ou localhost.
 */

import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
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
  console.log(`[1/5] Conectando ao Supabase local em ${LOCAL_URL}...`);
  const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const emailA = `user.a.${ts}@local.test`;
  const emailB = `user.b.${ts}@local.test`;
  const password = "TestPassword!2026";

  console.log(`[2/5] Criando dois usuários fictícios no Auth local (${emailA} e ${emailB})...`);
  const { data: signUpA, error: errA } = await anonClient.auth.signUp({ email: emailA, password });
  if (errA || !signUpA.user || !signUpA.session) {
    throw new Error(`Falha ao criar User A no Auth local: ${errA?.message}`);
  }

  const { data: signUpB, error: errB } = await anonClient.auth.signUp({ email: emailB, password });
  if (errB || !signUpB.user || !signUpB.session) {
    throw new Error(`Falha ao criar User B no Auth local: ${errB?.message}`);
  }

  const clientA = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signUpA.session.access_token}` } },
    auth: { persistSession: false },
  });

  const clientB = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signUpB.session.access_token}` } },
    auth: { persistSession: false },
  });

  console.log("[3/5] Testando gravação de seller_profiles e leads pelo Usuário A...");
  const { error: spErrA } = await clientA.from("seller_profiles").upsert({
    user_id: signUpA.user.id,
    company_name: "Agência A Local",
    main_service: "Automação de WhatsApp",
    commercial_maturity: "iniciante",
  });
  if (spErrA) throw new Error(`Falha ao gravar seller_profiles (User A): ${spErrA.message}`);

  const { data: leadA, error: leadErrA } = await clientA
    .from("leads")
    .insert({
      user_id: signUpA.user.id,
      nome: "Clínica Local A",
      nicho: "Odontologia",
      cidade: "Curitiba",
      foco: "Automação",
    })
    .select("id")
    .single();
  if (leadErrA || !leadA) throw new Error(`Falha ao gravar lead (User A): ${leadErrA?.message}`);

  console.log("[4/5] Testando isolamento RLS cruzado (Usuário B tentando ler/alterar dados do Usuário A)...");
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

  console.log("[5/5] Testando bloqueio de foco SDR interno (trg_guard_sdr_internal_focus_on_leads)...");
  const { error: sdrErr } = await clientB.from("leads").insert({
    user_id: signUpB.user.id,
    nome: "Lead Invasão SDR",
    foco: "zuno_internal_prospecting",
  });
  if (!sdrErr || !sdrErr.message.includes("SDR_ADMIN_ACCESS_REQUIRED")) {
    throw new Error(`FALHA DE TRIGGER SDR: Inserção indevida não foi bloqueada como esperado (${sdrErr?.message})`);
  }

  console.log("\n✅ HOMOLOGAÇÃO REAL NO POSTGRES LOCAL CONCLUÍDA COM 100% DE SUCESSO!");
}

main().catch((err) => {
  console.error("\n❌ ERRO NA VERIFICAÇÃO LOCAL:", err.message);
  process.exit(1);
});
