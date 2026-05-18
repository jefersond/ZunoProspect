import { useEffect, lazy, Suspense, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { LandingPageSkeleton } from "@/components/landing/LandingPageSkeleton";
import { getReferralFromSearch, persistReferralFromSearch } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";
import { captureAttributionParams, trackMetaCustomEvent, trackOnce } from "@/lib/metaPixel";

import { LPHeader } from "@/components/landing/LPHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { ComoFuncionaSection } from "@/components/landing/ComoFuncionaSection";
import { ParaQuemSection } from "@/components/landing/ParaQuemSection";
import { BeneficiosSection } from "@/components/landing/BeneficiosSection";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { MetricsCarousel } from "@/components/landing/MetricsCarousel";
import { FeatureSection } from "@/components/landing/FeatureSection";
import {
  MockupAnaliseIA,
  MockupBuscaLeads,
  MockupPipeline,
  MockupPlanoAbordagem,
} from "@/components/landing/mockups";

const ConfiancaOperacionalSection = lazy(() => import("@/components/landing/ConfiancaOperacionalSection").then((m) => ({
  default: m.ConfiancaOperacionalSection,
})));
const MetricasSection = lazy(() => import("@/components/landing/MetricasSection").then((m) => ({
  default: m.MetricasSection,
})));
const PrecosSection = lazy(() => import("@/components/landing/PrecosSection").then((m) => ({
  default: m.PrecosSection,
})));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then((m) => ({
  default: m.FAQSection,
})));
const ReferralSection = lazy(() => import("@/components/landing/ReferralSection").then((m) => ({
  default: m.ReferralSection,
})));
const CTAFinalSection = lazy(() => import("@/components/landing/CTAFinalSection").then((m) => ({
  default: m.CTAFinalSection,
})));
const Footer = lazy(() => import("@/components/landing/Footer").then((m) => ({
  default: m.Footer,
})));

const SectionSkeleton = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

const features = [
  {
    title: "Encontre quem abordar",
    description: "Veja empresas por cidade e nicho com dados úteis para começar sua prospecção.",
    mockup: <MockupBuscaLeads />,
    bullets: [
      "Busca por nicho e localização",
      "Lista de empresas em poucos cliques",
      "Dados úteis para iniciar contato",
    ],
  },
  {
    title: "Saiba o que falar",
    description: "A IA analisa o lead e gera abordagens para WhatsApp, Instagram ou e-mail.",
    mockup: <MockupAnaliseIA />,
    reversed: true,
    bullets: [
      "Análise sob demanda",
      "Mensagens prontas por canal",
      "Contexto para uma conversa melhor",
    ],
  },
  {
    title: "Organize o acompanhamento",
    description: "Salve leads, acompanhe status e mantenha sua rotina comercial em ordem.",
    mockup: <MockupPipeline />,
    bullets: [
      "Leads salvos em um só lugar",
      "Status para acompanhar conversas",
      "Follow-up sem depender da memória",
    ],
  },
  {
    title: "Priorize oportunidades",
    description: "Veja sinais digitais, score e contexto para decidir quem abordar primeiro.",
    mockup: <MockupAnaliseIA />,
    reversed: true,
    bullets: [
      "Score de oportunidade",
      "Sinais de presença digital",
      "Mais clareza antes da primeira mensagem",
    ],
  },
  {
    title: "Transforme leads em rotina",
    description: "Use o plano de prospecção de 7 dias para dar sequência sem improviso.",
    mockup: <MockupPlanoAbordagem />,
    bullets: [
      "Plano de abordagem estruturado",
      "Mensagens para diferentes canais",
      "Próximo passo claro para cada lead",
    ],
  },
];

export default function LandingProspeccaoIA() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const hasReferralInvite = Boolean(getReferralFromSearch(searchParams));

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/prospeccao", { replace: true });
      } else {
        persistReferralFromSearch(searchParams);
        setIsCheckingAuth(false);
      }
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const checkoutInProgress = sessionStorage.getItem("checkout_in_progress");
      if (session?.user && !checkoutInProgress) {
        navigate("/prospeccao", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (!isCheckingAuth) {
      const attribution = captureAttributionParams();
      trackEvent("page_view", { page: "landing" });
      if (attribution.ref) {
        trackOnce("meta_referral_visit", () => {
          trackMetaCustomEvent("Referral_Visit", {
            has_ref: true,
            ref_source: "url",
          });
        });
      }
      if (attribution.offer === "founder_pro" || attribution.utm_campaign === "founder") {
        trackOnce("meta_founder_offer_view", () => {
          trackMetaCustomEvent("Founder_Offer_View", {
            offer: "founder_pro",
            coupon: "FUNDADOR47",
          });
        });
      }
    }
  }, [isCheckingAuth]);

  if (isCheckingAuth) {
    return <LandingPageSkeleton />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <LPHeader />
      {hasReferralInvite && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-foreground">
          Você foi convidado para conhecer o Zuno Propect.
        </div>
      )}
      <HeroSection />
      <ComoFuncionaSection />
      <ParaQuemSection />
      <MetricsCarousel />
      <BeneficiosSection />
      <PainPointsSection />

      <div id="funcionalidades">
        {features.map((feature, index) => (
          <FeatureSection
            key={feature.title}
            title={feature.title}
            description={feature.description}
            mockup={feature.mockup}
            reversed={feature.reversed}
            bullets={feature.bullets}
            ctaText={index === features.length - 1 ? "Começar grátis" : undefined}
            ctaAction={index === features.length - 1 ? () => scrollToSection("precos") : undefined}
          />
        ))}
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        <MetricasSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ConfiancaOperacionalSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PrecosSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ReferralSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FAQSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CTAFinalSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <Footer />
      </Suspense>

      <FloatingWhatsAppButton />
    </div>
  );
}
