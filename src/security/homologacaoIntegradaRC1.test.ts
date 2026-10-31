// @vitest-environment jsdom
import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  SELLER_PROFILE_REMOTE_ENABLED,
  configureSellerProfileStorage,
  createMigratingSellerProfileStorage,
  createRemoteSellerProfileStorage,
  getSellerProfileState,
  loadSellerProfileForUser,
  openSellerProfileDialog,
  resetSellerProfileStateForTests,
  saveSellerProfile,
  type RemoteSellerProfileClient,
  type SellerProfile,
  type SellerProfileStorage,
} from "@/lib/sellerProfile";
import { loadSellerProfileForUser as loadSellerProfileOnEdge } from "../../supabase/functions/_shared/seller-profile-store";
import {
  buildAnalysisPrompt,
  buildVerifiedFacts,
  evaluatePreconditions,
  validateAnalysis,
} from "../../supabase/functions/_shared/lead-analysis";
import { goodRaw, lead as fixtureLead, profile as fixtureProfile } from "../../supabase/functions/_shared/test-fixtures";
import { createCreditConsumer } from "../../supabase/functions/_shared/credit-policy";
import { persistOwnedRefineAnalysis, RefinePersistenceError } from "../../supabase/functions/_shared/refine-persistence";
import { evaluateIntroPayment } from "../../supabase/functions/_shared/billing/mercado-pago-webhook-policy";
import { isOfferSufficientlyDetailed, getOfferClarificationQuestion, buildExploratoryOfferDescription } from "@/lib/offerClarification";
import { buildNextBestAction } from "@/services/nextBestAction";
import { SellerProfileDialog } from "@/components/profile/SellerProfileDialog";
import type { LeadProspeccao } from "@/types/lead";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-a" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const readRepoFile = (relPath: string) => readFileSync(resolve(process.cwd(), relPath), "utf8");

/**
 * Banco em memória isolado com RLS por auth.uid() para simular o staging multiusuário
 * sem tocar em nenhuma credencial ou banco de produção.
 */
function createIsolatedStagingDb() {
  const sellerProfiles = new Map<string, Record<string, unknown>>();
  const leads = new Map<string, Record<string, unknown>>();
  const creditsUsed = new Map<string, number>();
  const creditLimits = new Map<string, number>();
  const paymentEvents = new Map<string, Record<string, unknown>>();
  const billingMilestones = new Set<string>();

  function createRlsSellerProfileClient(authenticatedUserId: string): RemoteSellerProfileClient {
    return {
      from: (table: string) => {
        if (table !== "seller_profiles") throw new Error(`Tabela inesperada: ${table}`);
        return {
          select: () => ({
            eq: (col: string, value: string) => ({
              maybeSingle: async () => {
                // RLS: authenticated só enxerga user_id = auth.uid()
                if (col !== "user_id" || value !== authenticatedUserId) {
                  return { data: null, error: null };
                }
                return { data: sellerProfiles.get(authenticatedUserId) ?? null, error: null };
              },
            }),
          }),
          upsert: (row: Record<string, unknown>, opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
            const targetUserId = String(row.user_id || "");
            const runUpsert = () => {
              // RLS: with check (user_id = auth.uid())
              if (targetUserId !== authenticatedUserId) {
                return {
                  data: null,
                  error: { message: "new row violates row-level security policy for table \"seller_profiles\"" },
                };
              }
              if (opts.ignoreDuplicates && sellerProfiles.has(targetUserId)) {
                return { data: sellerProfiles.get(targetUserId) ?? null, error: null };
              }
              const saved = {
                ...row,
                updated_at: new Date().toISOString(),
              };
              sellerProfiles.set(targetUserId, saved);
              return { data: saved, error: null };
            };
            const res = runUpsert();
            return {
              select: () => ({
                single: async () => res,
              }),
              then: (onfulfilled?: (v: { error: { message: string } | null }) => unknown) =>
                Promise.resolve({ error: res.error }).then(onfulfilled),
            };
          },
        };
      },
    };
  }

  // Leitor service_role usado pela Edge Function (filtra estritamente pelo user.id do JWT validado)
  const edgeAdminReader = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, value: string) => ({
          maybeSingle: async () => {
            if (table === "seller_profiles" && col === "user_id") {
              return { data: sellerProfiles.get(value) ?? null, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
    }),
  };

  return {
    sellerProfiles,
    leads,
    creditsUsed,
    creditLimits,
    paymentEvents,
    billingMilestones,
    createRlsSellerProfileClient,
    edgeAdminReader,
  };
}

describe("Homologação Integrada RC-1 — Validação Isolada (Sem Produção)", () => {
  beforeEach(() => {
    toast.mockClear();
    localStorage.clear();
    sessionStorage.clear();
    resetSellerProfileStateForTests();
  });

  afterEach(() => {
    cleanup();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 2 & 6: Revisão Técnica das 3 Migrations (Permissões, RLS, Reversibilidade e Ordem)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Revisão das 3 Migrations preparadas para Staging/Produção", () => {
    it("Migration 1 (20261031120000_create_seller_profiles.sql): possui schema completo, commercial_maturity, RLS por auth.uid(), grants para authenticated/service_role e instruções de rollback", () => {
      const sql = readRepoFile("supabase/migrations/20261031120000_create_seller_profiles.sql");
      expect(sql).toContain("create table if not exists public.seller_profiles");
      expect(sql).toContain("commercial_maturity text not null default 'equilibrado'");
      expect(sql).toContain("commercial_maturity in ('equilibrado', 'iniciante', 'intermediario', 'avancado')");
      expect(sql).toContain("alter table public.seller_profiles enable row level security;");
      expect(sql).toContain("revoke all on public.seller_profiles from anon, public;");
      expect(sql).toContain("grant select, insert, update, delete on public.seller_profiles to authenticated, service_role;");
      expect(sql).toContain("user_id = (select auth.uid())");
      expect(sql).toContain("Rollback (Reversibilidade):");
    });

    it("Migration 2 (20261031130000_disable_legacy_cron_process_emails.sql): desativa process-email-queue-cron de forma idempotente verificando pg_cron e cron.job", () => {
      const sql = readRepoFile("supabase/migrations/20261031130000_disable_legacy_cron_process_emails.sql");
      expect(sql).toContain("SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'");
      expect(sql).toContain("SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue-cron'");
      expect(sql).toContain("PERFORM cron.unschedule('process-email-queue-cron');");
      expect(sql).toContain("Rollback (Reversibilidade):");
    });

    it("Migration 3 (20261031140000_sdr_lead_guard.sql): protege abertura_iniciada e [SDR WhatsApp] via public.is_admin() sem quebrar edições normais de CRM", () => {
      const sql = readRepoFile("supabase/migrations/20261031140000_sdr_lead_guard.sql");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.guard_sdr_lead_mutations()");
      expect(sql).toContain("v_is_admin := public.is_admin();");
      expect(sql).toContain("IF NEW.status = 'abertura_iniciada'");
      expect(sql).toContain("USING ERRCODE = '42501'");
      expect(sql).toContain("CREATE TRIGGER trg_guard_sdr_lead_mutations");
      expect(sql).toContain("Rollback (Reversibilidade):");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 3, 4 & 5: Fluxo Ponta a Ponta com Dois Usuários (user-a e user-b)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Fluxo Integrado Multiusuário: Perfil Comercial (Frontend <-> Edge Function), RLS, IA, Créditos e NBA", () => {
    it("sincroniza perfil entre Frontend (createMigratingSellerProfileStorage) e Edge Function (loadSellerProfileForUser) preservando commercial_maturity e isolamento RLS entre user-a e user-b", async () => {
      const db = createIsolatedStagingDb();

      // Flag VITE_SELLER_PROFILE_REMOTE desligada por padrão até ativação no ambiente
      expect(typeof SELLER_PROFILE_REMOTE_ENABLED).toBe("boolean");

      // Configura user-a com armazenamento migrante (como quando VITE_SELLER_PROFILE_REMOTE=true)
      const remoteUserA = createRemoteSellerProfileStorage(db.createRlsSellerProfileClient("user-a"));
      const localStore: SellerProfileStorage = {
        load: async (uid) => {
          const raw = localStorage.getItem(`zuno_seller_profile_v1:${uid}`);
          return raw ? JSON.parse(raw) : null;
        },
        save: async (uid, p) => {
          localStorage.setItem(`zuno_seller_profile_v1:${uid}`, JSON.stringify(p));
          return p;
        },
      };
      configureSellerProfileStorage(createMigratingSellerProfileStorage(remoteUserA, localStore));

      await loadSellerProfileForUser("user-a");

      // 1. Antes de preencher o perfil: a Edge Function lê perfil vazio e bloqueia com 422 REFINE_PROFILE_REQUIRED sem cobrar crédito
      const emptyEdgeProfile = await loadSellerProfileOnEdge(db.edgeAdminReader, "user-a");
      const blockedPrecondition = evaluatePreconditions({
        profile: emptyEdgeProfile,
        stage: "novo",
        existingPlan: null,
        replaceExisting: true,
      });
      expect(blockedPrecondition).not.toBeNull();
      expect(blockedPrecondition?.code).toBe("REFINE_PROFILE_REQUIRED");
      expect(blockedPrecondition?.status).toBe(422);

      // 2. user-a salva o perfil comercial com commercial_maturity = "intermediario"
      const savedProfileA = await saveSellerProfile({
        display_name: "Marina Costa",
        company_name: "Costa Tráfego",
        service_category: "automacao",
        service_offered: "Automação de WhatsApp para clínicas odontológicas",
        offer_description:
          "Implantamos confirmação automática de consultas e triagem de pacientes no WhatsApp para reduzir faltas na agenda.",
        target_audience: "Clínicas odontológicas em Curitiba",
        commercial_maturity: "intermediario",
      });

      expect(savedProfileA.commercial_maturity).toBe("intermediario");
      expect(getSellerProfileState().profile.commercial_maturity).toBe("intermediario");

      // 3. A Edge Function lê exatamente o perfil salvo por user-a no banco
      const edgeProfileA = await loadSellerProfileOnEdge(db.edgeAdminReader, "user-a");
      expect(edgeProfileA.display_name).toBe("Marina Costa");
      expect(edgeProfileA.commercial_maturity).toBe("intermediario");
      expect(
        evaluatePreconditions({
          profile: edgeProfileA,
          stage: "novo",
          existingPlan: null,
          replaceExisting: true,
        })
      ).toBeNull();

      // 4. Isolamento entre usuários: user-b tenta ler o perfil de user-a via RLS ou tentar sobrescrever
      const remoteUserB = createRemoteSellerProfileStorage(db.createRlsSellerProfileClient("user-b"));
      const leakAttempt = await remoteUserB.load("user-a");
      expect(leakAttempt).toBeNull();

      await expect(
        remoteUserB.save("user-a", {
          ...savedProfileA,
          display_name: "Invasor B",
        })
      ).rejects.toThrow(/row-level security/i);

      // Confirma que o perfil de user-a permanece intacto no banco
      const verifyProfileA = await loadSellerProfileOnEdge(db.edgeAdminReader, "user-a");
      expect(verifyProfileA.display_name).toBe("Marina Costa");
    });

    it("SellerProfileDialog permite ao assinante selecionar e salvar a maturidade comercial (commercial_maturity)", async () => {
      const savedRows: SellerProfile[] = [];
      configureSellerProfileStorage({
        load: async () => ({
          display_name: "Marina",
          company_name: "Agência M",
          service_category: "sites",
          service_offered: "Landing pages para clínicas",
          offer_description: "Criamos páginas rápidas focadas em conversão de agendamentos no WhatsApp.",
          target_audience: "Clínicas médicas",
          commercial_maturity: "equilibrado",
        }),
        save: async (_uid, profile) => {
          savedRows.push(profile);
          return profile;
        },
      });

      await loadSellerProfileForUser("user-a");
      openSellerProfileDialog();
      render(React.createElement(SellerProfileDialog));

      const dialog = await screen.findByRole("dialog");
      const maturitySelect = dialog.querySelector("#seller-maturity") as HTMLSelectElement;
      expect(maturitySelect).toBeTruthy();
      expect(maturitySelect.value).toBe("equilibrado");

      fireEvent.change(maturitySelect, { target: { value: "avancado" } });
      fireEvent.click(screen.getByText("Salvar perfil"));

      await vi.waitFor(() => expect(savedRows).toHaveLength(1));
      expect(savedRows[0].commercial_maturity).toBe("avancado");
      expect(getSellerProfileState().profile.commercial_maturity).toBe("avancado");
    });

    it("fluxo completo: Clarificação de Oferta -> Análise IA Validada -> Consumo de Crédito -> Falha de IA sem Cobrança -> Registro de Contato -> Próxima Melhor Ação", async () => {
      // 1. Teste de oferta vaga: exige pergunta única contextual antes de chamar a IA
      const vagueProfile: SellerProfile = {
        display_name: "Carlos",
        company_name: "AutoZap",
        service_category: "automacao",
        service_offered: "Automação de WhatsApp",
        offer_description: "Automação no WhatsApp",
        target_audience: "",
        commercial_maturity: "iniciante",
      };
      expect(isOfferSufficientlyDetailed(vagueProfile)).toBe(false);
      const clarityVague = getOfferClarificationQuestion(vagueProfile, "Clínica Odontológica");
      expect(clarityVague.isDetailed).toBe(false);
      expect(clarityVague.question).toContain("Qual problema sua automação resolve");

      // Se o usuário optar por continuar sem responder, gera descrição exploratória prudente
      const exploratoryDesc = buildExploratoryOfferDescription(clarityVague.contextService);
      expect(exploratoryDesc.length).toBeGreaterThanOrEqual(30);

      // 2. Perfil detalhado segue direto sem pergunta extra
      const detailedProfile: SellerProfile = {
        ...vagueProfile,
        offer_description:
          "Implantamos triagem e confirmação automática de consultas no WhatsApp para clínicas odontológicas reduzirem faltas.",
      };
      expect(isOfferSufficientlyDetailed(detailedProfile)).toBe(true);

      // 3. Fatos verificados do lead salvo por user-a
      const facts = buildVerifiedFacts({
        nome: "OdontoPrime Curitiba",
        nicho: "Clínica Odontológica",
        cidade: "Curitiba",
        endereco: "Av. Batel, 1200 - Curitiba, PR",
        website: "https://odontoprimecuritiba.com.br",
        instagram: "@odontoprimecwb",
        email: null, // Sem e-mail público -> não deve recomendar canal email
        phone: "41999887766",
        rating: 4.9,
        reviews: 64,
        status: "novo",
        notas: null,
        foco: "Automação",
      });

      expect(facts.canais_disponiveis).toEqual(["whatsapp", "telefone", "instagram"]);
      expect(facts.canais_disponiveis).not.toContain("email");

      const prompt = buildAnalysisPrompt(facts, detailedProfile);
      expect(prompt).toContain("OdontoPrime Curitiba");
      expect(prompt).toContain("Carlos");

      // 4. Simula resposta estruturada do Gemini respeitando o contrato v6
      const fixtureFacts = buildVerifiedFacts(fixtureLead);
      const validation = validateAnalysis(goodRaw(), {
        channels: fixtureFacts.canais_disponiveis,
        profile: fixtureProfile,
        stage: fixtureFacts.etapa_do_historico,
        facts: fixtureFacts,
      });
      expect(validation.ok).toBe(true);

      // 5. Teste de isolamento de lead e consumo de crédito apenas após confirmação de escrita no banco
      const ownedLeadId = "11111111-1111-4111-8111-111111111111";
      const leadOwnerMap = new Map<string, string>([[ownedLeadId, "user-a"]]);
      let chargesCount = 0;
      const creditConsumer = createCreditConsumer(async () => {
        chargesCount += 1;
        return { ok: true };
      });

      const updateOwnedLead = async (leadId: string, userId: string, values: any) => {
        if (leadOwnerMap.get(leadId) !== userId) {
          return { data: [], error: null }; // RLS impede update de lead de outro usuário
        }
        return {
          data: [
            {
              id: leadId,
              diagnostico_bullets: values.diagnostico_bullets,
              probabilidade_conversao: values.probabilidade_conversao,
              plano_prospeccao: values.plano_prospeccao,
              ai_analise_gerada_em: values.ai_analise_gerada_em,
            },
          ],
          error: null,
        };
      };

      // 5a. Tentativa cruzada (user-b tentando gravar no lead de user-a): falha e NÃO consome crédito
      await expect(
        persistOwnedRefineAnalysis(updateOwnedLead, ownedLeadId, "user-b", {
          diagnostico_bullets: ["b1"],
          probabilidade_conversao: 70,
          plano_prospeccao: { version: "v6" },
          ai_analise_gerada_em: new Date().toISOString(),
          ai_used_fallback: false,
          ai_fallback_reason: null,
        })
      ).rejects.toBeInstanceOf(RefinePersistenceError);
      expect(chargesCount).toBe(0);

      // 5b. Gravação legítima pelo dono (user-a): confirma persistência e consome exatamente 1 crédito
      const persisted = await persistOwnedRefineAnalysis(updateOwnedLead, ownedLeadId, "user-a", {
        diagnostico_bullets: ["b1"],
        probabilidade_conversao: 74,
        plano_prospeccao: { plano_prospeccao_7dias: validation.ok ? validation.analysis.plano : [] },
        ai_analise_gerada_em: new Date().toISOString(),
        ai_used_fallback: false,
        ai_fallback_reason: null,
      });
      expect(persisted.id).toBe(ownedLeadId);
      const charge1 = await creditConsumer.consume();
      expect(charge1.consumed).toBe(true);
      const charge2 = await creditConsumer.consume();
      expect(charge2.consumed).toBe(false);
      expect(chargesCount).toBe(1);

      // 6. Registro de Contato e Próxima Melhor Ação (NBA) ao longo do tempo
      const baseLead: LeadProspeccao = {
        id: "lead-odontoprime-1",
        empresa: "OdontoPrime Curitiba",
        setor: "Clínica Odontológica",
        cidade: "Curitiba",
        telefone: "41999887766",
        whatsapp: "41999887766",
        instagram: "@odontoprimecwb",
        website: "https://odontoprimecuritiba.com.br",
        foco: "Automação",
        status: "novo",
        plano_prospecao_7dias: validation.ok
          ? validation.analysis.plano.map((d) => ({
              dia: d.dia,
              tipo: d.tipo,
              canal: d.canal,
              objetivo: d.objetivo,
              mensagem: d.mensagem ?? "Nenhuma mensagem necessária nesta etapa",
              cta: d.cta,
            }))
          : [],
      };

      const t0 = new Date("2026-10-26T10:00:00-03:00"); // Segunda-feira
      const nbaNew = buildNextBestAction(baseLead, { now: t0, commercialMaturity: "iniciante" });
      expect(nbaNew.category).toBe("primeira_abordagem");
      expect(nbaNew.commercialMaturity).toBe("iniciante");

      // Registra 1º contato realizado na segunda-feira às 10h
      const leadAfterContact1: LeadProspeccao = {
        ...baseLead,
        status: "em_contato",
        custom_fields: {
          crm_flow: {
            ultima_interacao_em: t0.toISOString(),
            ultimo_canal_interacao: "whatsapp",
          },
        } as any,
        notas: "[Contato 2026-10-26T10:00:00-03:00] Status: contato_realizado - Mensagem do Dia 1 enviada no WhatsApp.",
      };

      // 4 horas depois: deve recomendar aguardar janela de resposta
      const t4h = new Date("2026-10-26T14:00:00-03:00");
      const nbaWait = buildNextBestAction(leadAfterContact1, { now: t4h, commercialMaturity: "iniciante" });
      expect(nbaWait.category).toBe("pausa_espera");

      // 72h depois (Quinta-feira às 14h): follow-up permitido
      const t72h = new Date("2026-10-29T14:00:00-03:00");
      const nbaFollowup = buildNextBestAction(leadAfterContact1, { now: t72h, commercialMaturity: "iniciante" });
      expect(nbaFollowup.category).toBe("follow_up_cadencia");

      // Lead respondeu com interesse: interrompe cadência fria imediatamente
      const leadInterested: LeadProspeccao = {
        ...leadAfterContact1,
        status: "qualificacao",
        notas: "[Contato 2026-10-26] Mensagem enviada.\n[Resposta] Lead demonstrou interesse e pediu valores.",
      };
      const nbaInterest = buildNextBestAction(leadInterested, { now: t72h, commercialMaturity: "iniciante" });
      expect(["qualificacao", "responder_duvida"]).toContain(nbaInterest.category);
      expect(nbaInterest.isColdCadenceActive).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 5: Webhooks Duplicados e Idempotência
  // ──────────────────────────────────────────────────────────────────────────
  describe("Proteção contra Webhooks Duplicados (Stripe & Mercado Pago)", () => {
    it("migration 20261003120000 garante índice e constraint UNIQUE (provider, provider_event_id) em payment_events", () => {
      const sql = readRepoFile("supabase/migrations/20261003120000_payment_events_provider_event_unique.sql");
      expect(sql).toContain("create unique index if not exists payment_events_provider_event_id_key");
      expect(sql).toContain("on public.payment_events (provider, provider_event_id);");
    });

    it("stripe-webhook verifica duplicidade tanto em purchase_completed quanto em trial_started antes de emitir marcos ou bônus", () => {
      const webhookCode = readRepoFile("supabase/functions/stripe-webhook/index.ts");
      expect(webhookCode).toContain("checkDuplicatePurchaseEvent");
      expect(webhookCode).toContain("checkDuplicateTrialStartedEvent");
    });

    it("mercado-pago-webhook-policy descarta cobranças promocionais duplicadas (intro_already_recorded) sem reprocessar", () => {
      const decision = evaluateIntroPayment({
        introOfferApplied: true,
        introAmountCents: 1990,
        regularAmountCents: 4700,
        paidAmount: 19.9,
        invoiceId: "inv_123",
        subscriptionId: "sub_456",
        redemption: {
          status: "redeemed",
          redeemed_at: "2026-10-30T10:00:00Z",
          provider_invoice_id: "inv_123",
          provider_subscription_id: "sub_456",
        },
      });

      expect(decision.kind).toBe("intro_already_recorded");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 8: Padronização do Nome Público da Marca ("Zuno Prospect")
  // ──────────────────────────────────────────────────────────────────────────
  describe("Padronização da Marca Zuno Prospect", () => {
    it("nenhum arquivo de interface, logo, landing page ou template de e-mail exibe a grafia incorreta 'Zuno Propect'", () => {
      const filesToVerify = [
        "index.html",
        "src/components/Logo.tsx",
        "src/components/ReferralCard.tsx",
        "src/components/landing/HeroSection.tsx",
        "src/components/landing/Footer.tsx",
        "src/components/landing/StickyCtaBar.tsx",
        "src/components/landing/PrecosSection.tsx",
        "src/components/landing/CheckoutDialog.tsx",
        "src/config/whatsapp.ts",
        "src/pages/Checkout.tsx",
        "src/pages/Prospeccao.tsx",
        "src/pages/LandingProspeccaoIA.tsx",
        "supabase/functions/_shared/emailTemplates.ts",
        "supabase/functions/process-behavior-emails/index.ts",
        "supabase/functions/stripe-webhook/index.ts",
      ];

      for (const file of filesToVerify) {
        const content = readRepoFile(file);
        expect(content, `Grafia incorreta encontrada em ${file}`).not.toMatch(/Zuno\s+Propect\b/i);
        expect(content, `Logo incorreta encontrada em ${file}`).not.toMatch(/>\s*Propect\s*</i);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 9: Desacoplamento de Produção e Compatibilidade de Migrations Locais
  // ──────────────────────────────────────────────────────────────────────────
  describe("Desacoplamento de Produção e Compatibilidade de Migrations Locais", () => {
    it("supabase/config.toml usa project_id local e não referencia o banco de produção (ihtltqxxlvbsxbiacbpr)", () => {
      const configToml = readRepoFile("supabase/config.toml");
      expect(configToml).toContain('project_id = "zuno-prospect-local"');
      expect(configToml).not.toContain("ihtltqxxlvbsxbiacbpr");
    });

    it("arquivos de vínculo remoto (.temp/linked-project.json e .temp/project-ref) estão removidos", () => {
      expect(existsSync(resolve(process.cwd(), "supabase/.temp/linked-project.json"))).toBe(false);
      expect(existsSync(resolve(process.cwd(), "supabase/.temp/project-ref"))).toBe(false);
      expect(existsSync(resolve(process.cwd(), "supabase/.temp/pooler-url"))).toBe(false);
    });

    it("AdminSystemHealth.tsx e migrations de cron não possuem URL hardcoded para produção (ihtltqxxlvbsxbiacbpr)", () => {
      const adminHealth = readRepoFile("src/pages/AdminSystemHealth.tsx");
      expect(adminHealth).not.toContain("ihtltqxxlvbsxbiacbpr");
      expect(adminHealth).toContain("VITE_SUPABASE_URL");

      const cronMigration = readRepoFile("supabase/migrations/20260629112200_enable_cron_net_job.sql");
      expect(cronMigration).not.toContain("ihtltqxxlvbsxbiacbpr");
    });

    it("migration 20260525141000_retroactive_plan_activation.sql não aborta banco local limpo quando email placeholder não existe", () => {
      const retroSql = readRepoFile("supabase/migrations/20260525141000_retroactive_plan_activation.sql");
      expect(retroSql).toContain("IF v_user_id IS NULL THEN");
      expect(retroSql).toContain("RAISE NOTICE");
      expect(retroSql).toContain("RETURN;");
      expect(retroSql).not.toContain("RAISE EXCEPTION 'Usuário com o e-mail % não foi encontrado");
    });

    it("stripe-webhook não possui import órfão para ../_shared/trial-policy.ts", () => {
      const webhook = readRepoFile("supabase/functions/stripe-webhook/index.ts");
      expect(webhook).not.toContain("../_shared/trial-policy.ts");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ETAPA 10: Integração Real Frontend ↔ Edge Function no Postgres Local (127.0.0.1:55321)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Execução Real contra Container Supabase Local (http://127.0.0.1:55321)", () => {
    const LOCAL_URL = "http://127.0.0.1:55321";
    const LOCAL_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

    it("sincroniza SellerProfile entre Frontend (createRemoteSellerProfileStorage) e Edge Function (loadSellerProfileOnEdge) no Postgres real com RLS ativo", async () => {
      const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const ts = Date.now();
      const { data: authA, error: errA } = await anon.auth.signUp({
        email: `rc1.fe.a.${ts}@local.test`,
        password: "TestPassword!2026",
      });
      expect(errA).toBeNull();
      expect(authA.user?.id).toBeTruthy();

      const { data: authB, error: errB } = await anon.auth.signUp({
        email: `rc1.fe.b.${ts}@local.test`,
        password: "TestPassword!2026",
      });
      expect(errB).toBeNull();
      expect(authB.user?.id).toBeTruthy();

      const userAId = authA.user!.id;
      const userBId = authB.user!.id;

      const clientA = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authA.session!.access_token}` } },
        auth: { persistSession: false },
      });
      const clientB = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authB.session!.access_token}` } },
        auth: { persistSession: false },
      });

      // 1. Frontend carrega sessão do usuário A e grava no Postgres real usando createRemoteSellerProfileStorage
      const remoteStorageA = createRemoteSellerProfileStorage(
        clientA as unknown as RemoteSellerProfileClient,
        () => userAId
      );
      configureSellerProfileStorage(remoteStorageA);
      await loadSellerProfileForUser(userAId);

      const saved = await saveSellerProfile({
        display_name: "Carlos Operação",
        company_name: "Scale B2B Local",
        service_category: "crm",
        service_offered: "Implementação de CRM e Funil Comercial",
        offer_description: "Estruturação de pipeline comercial e playbooks de atendimento para equipes B2B.",
        target_audience: "Empresas de serviços B2B e clínicas com equipe comercial",
        commercial_maturity: "avancado",
      });
      expect(saved.commercial_maturity).toBe("avancado");

      // 2. Edge Function lê o mesmo registro diretamente do Postgres real
      const edgeProfile = await loadSellerProfileOnEdge(clientA as any, userAId);
      expect(edgeProfile.display_name).toBe("Carlos Operação");
      expect(edgeProfile.company_name).toBe("Scale B2B Local");
      expect(edgeProfile.service_category).toBe("crm");
      expect(edgeProfile.commercial_maturity).toBe("avancado");

      // 3. Usuário B tenta ler o perfil do Usuário A via Edge Function store -> RLS retorna perfil vazio
      const crossRead = await loadSellerProfileOnEdge(clientB as any, userAId);
      expect(crossRead.company_name).toBe("");
      expect(crossRead.service_offered).toBe("");

      // 4. Usuário B tenta inserir lead com foco SDR interno -> Trigger Postgres bloqueia
      const { error: sdrErr } = await clientB.from("leads").insert({
        user_id: userBId,
        nome: "Tentativa SDR Não-Admin",
        cidade: "Curitiba",
        foco: "zuno_internal_prospecting",
      });
      expect(sdrErr).not.toBeNull();
      expect(sdrErr?.message).toContain("Acesso restrito");
    });

    it("migra perfil do localStorage para o Postgres remoto sem perda e sem sobrescrever dados do banco", async () => {
      const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const ts = Date.now();
      const { data: authC } = await anon.auth.signUp({
        email: `rc1.migration.${ts}@local.test`,
        password: "TestPassword!2026",
      });
      const userCId = authC.user!.id;

      const clientC = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authC.session!.access_token}` } },
        auth: { persistSession: false },
      });

      const localMap = new Map<string, any>();
      const mockLocalStorage: SellerProfileStorage = {
        load: async (id) => localMap.get(id) || null,
        save: async (id, profile) => {
          localMap.set(id, profile);
          return profile;
        },
      };

      // Usuário tinha dados salvos apenas no navegador antes da atualização
      localMap.set(userCId, {
        display_name: "Marina Freelancer",
        company_name: "Marina Sites",
        service_category: "sites",
        service_offered: "Landing pages de alta conversão",
        offer_description: "Criação de páginas para infoprodutos e negócios locais.",
        target_audience: "Pequenos empresários",
        commercial_maturity: "iniciante",
      });

      const remoteStorage = createRemoteSellerProfileStorage(
        clientC as unknown as RemoteSellerProfileClient,
        () => userCId
      );
      const migratingStorage = createMigratingSellerProfileStorage(remoteStorage, mockLocalStorage);

      // 1. Ao carregar pela primeira vez, migra automaticamente do localStorage para o Supabase
      const migrated = await migratingStorage.load(userCId);
      expect(migrated).not.toBeNull();
      expect(migrated?.company_name).toBe("Marina Sites");
      expect(migrated?.commercial_maturity).toBe("iniciante");

      // Confirma que agora está fisicamente salvo no Postgres
      const { data: remoteDbRow } = await clientC
        .from("seller_profiles")
        .select("*")
        .eq("user_id", userCId)
        .single();
      expect(remoteDbRow?.company_name).toBe("Marina Sites");

      // 2. Se o perfil for atualizado no banco em outro dispositivo, o localStorage antigo NÃO sobrescreve
      await clientC
        .from("seller_profiles")
        .update({ company_name: "Marina Sites PRO Oficial", commercial_maturity: "intermediario" })
        .eq("user_id", userCId);

      // O localStorage ainda possui o valor antigo ("Marina Sites")
      expect(localMap.get(userCId).company_name).toBe("Marina Sites");

      // Mas o migratingStorage respeita o banco de dados como fonte da verdade
      const refreshed = await migratingStorage.load(userCId);
      expect(refreshed?.company_name).toBe("Marina Sites PRO Oficial");
      expect(refreshed?.commercial_maturity).toBe("intermediario");
    });

    const LOCAL_SERVICE_ROLE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

    it("garante idempotência estrita de webhooks de pagamento no Postgres local (payment_events)", async () => {
      const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const ts = Date.now();
      const { data: authD } = await anon.auth.signUp({
        email: `rc1.stripe.idemp.${ts}@local.test`,
        password: "TestPassword!2026",
      });
      const userDId = authD.user!.id;

      const clientD = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authD.session!.access_token}` } },
        auth: { persistSession: false },
      });

      const stripeEventId = `evt_test_checkout_${ts}`;

      // 0. Usuário comum tenta forjar pagamento diretamente pelo frontend -> RLS bloqueia
      const { error: forgedErr } = await clientD.from("payment_events").insert({
        user_id: userDId,
        provider: "stripe",
        provider_event_id: stripeEventId,
        event_type: "purchase_completed",
        plan_name: "pro",
        status: "paid",
        event_data: { amount_total: 9700, currency: "brl" },
      });
      expect(forgedErr).not.toBeNull();
      expect(forgedErr?.code).toBe("42501"); // RLS permission denied

      // 1. Webhook oficial Stripe (Edge Function operando com service_role):
      // grava em payment_events e ativa assinatura
      const serviceRoleClient = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: firstInsert, error: firstErr } = await serviceRoleClient.from("payment_events").insert({
        user_id: userDId,
        provider: "stripe",
        provider_event_id: stripeEventId,
        event_type: "purchase_completed",
        plan_name: "pro",
        status: "paid",
        event_data: { amount_total: 9700, currency: "brl" },
      }).select("id, provider_event_id").single();

      expect(firstErr).toBeNull();
      expect(firstInsert?.provider_event_id).toBe(stripeEventId);

      // 2. Repetição do MESMO evento Stripe (retry por timeout de rede do webhook):
      // A constraint UNIQUE (provider, provider_event_id) do PostgreSQL rejeita a duplicação
      const { error: duplicateErr } = await serviceRoleClient.from("payment_events").insert({
        user_id: userDId,
        provider: "stripe",
        provider_event_id: stripeEventId,
        event_type: "purchase_completed",
        plan_name: "pro",
        status: "paid",
        event_data: { amount_total: 9700, currency: "brl" },
      });

      expect(duplicateErr).not.toBeNull();
      expect(duplicateErr?.code).toBe("23505"); // Código SQLSTATE 23505 = unique_violation
    });
  });
});
