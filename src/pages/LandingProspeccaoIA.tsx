import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { LandingPageSkeleton } from "@/components/landing/LandingPageSkeleton";
import { getReferralFromSearch, persistReferralFromSearch } from "@/lib/referral";

// Critical components - loaded immediately
import { LPHeader } from "@/components/landing/LPHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { BeneficiosSection } from "@/components/landing/BeneficiosSection";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { MetricsCarousel } from "@/components/landing/MetricsCarousel";
import { FeatureSection } from "@/components/landing/FeatureSection";

// Mockups for features
import { 
  MockupBuscaLeads, 
  MockupAnaliseIA, 
  MockupPlanoAbordagem, 
  MockupPipeline, 
  MockupRelatorios, 
  MockupLeadsSalvos 
} from "@/components/landing/mockups";

// Lazy loaded components - below the fold
const DepoimentosSection = lazy(() => import("@/components/landing/DepoimentosSection").then(m => ({
  default: m.DepoimentosSection
})));
const MetricasSection = lazy(() => import("@/components/landing/MetricasSection").then(m => ({
  default: m.MetricasSection
})));
const ParaQuemSection = lazy(() => import("@/components/landing/ParaQuemSection").then(m => ({
  default: m.ParaQuemSection
})));
const PrecosSection = lazy(() => import("@/components/landing/PrecosSection").then(m => ({
  default: m.PrecosSection
})));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then(m => ({
  default: m.FAQSection
})));
const ReferralSection = lazy(() => import("@/components/landing/ReferralSection").then(m => ({
  default: m.ReferralSection
})));
const CTAFinalSection = lazy(() => import("@/components/landing/CTAFinalSection").then(m => ({
  default: m.CTAFinalSection
})));
const Footer = lazy(() => import("@/components/landing/Footer").then(m => ({
  default: m.Footer
})));

const SectionSkeleton = () => (
  <div className="py-16 flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

const features = [
  {
    title: "Encontre leads qualificados em minutos",
    description: "Digite o nicho e a cidade. Nossa IA encontra empresas com presença digital ativa e prontas para investir em marketing.",
    mockup: <MockupBuscaLeads />,
    bullets: [
      "Busca por nicho e localização",
      "Filtros avançados de qualificação",
      "Dados de contato verificados"
    ]
  },
  {
    title: "Diagnóstico completo de cada lead",
    description: "A IA analisa site, redes sociais, avaliações e gera uma pontuação de probabilidade de conversão para cada empresa.",
    mockup: <MockupAnaliseIA />,
    reversed: true,
    bullets: [
      "Análise de presença digital",
      "Score de probabilidade de conversão",
      "Pontos fortes e fracos identificados"
    ]
  },
  {
    title: "Cadências prontas para WhatsApp, email e Instagram",
    description: "Receba um plano de 7 dias com mensagens personalizadas para cada lead, prontas para copiar e enviar.",
    mockup: <MockupPlanoAbordagem />,
    bullets: [
      "Mensagens personalizadas por canal",
      "Sequência de 7 dias estruturada",
      "Scripts de follow-up inclusos"
    ]
  },
  {
    title: "Organize seus leads em um funil visual",
    description: "Arraste e solte leads entre etapas do pipeline. Nunca perca uma oportunidade de fechar negócio.",
    mockup: <MockupPipeline />,
    reversed: true,
    bullets: [
      "Kanban visual e intuitivo",
      "Acompanhamento de status",
      "Histórico de interações"
    ]
  },
  {
    title: "Relatórios e métricas de performance",
    description: "Acompanhe seus resultados com dashboards completos. Saiba quantos leads prospectou, taxa de conversão e muito mais.",
    mockup: <MockupRelatorios />,
    bullets: [
      "KPIs em tempo real",
      "Gráficos de performance",
      "Exportação de dados"
    ]
  },
  {
    title: "Salve e organize seus melhores leads",
    description: "Marque leads como favoritos e acesse rapidamente. Adicione notas e acompanhe todo o histórico de interações.",
    mockup: <MockupLeadsSalvos />,
    reversed: true,
    bullets: [
      "Lista de leads favoritos",
      "Notas e anotações personalizadas",
      "Filtros e busca avançada"
    ]
  }
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
        data: { session }
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
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      const checkoutInProgress = sessionStorage.getItem("checkout_in_progress");
      if (session?.user && !checkoutInProgress) {
        navigate("/prospeccao", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  if (isCheckingAuth) {
    return <LandingPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LPHeader />
      {hasReferralInvite && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-foreground">
          Voce foi convidado para conhecer o Zuno Propect.
        </div>
      )}
      <HeroSection />
      <BeneficiosSection />
      <PainPointsSection />
      <MetricsCarousel />
      
      {/* Feature Sections */}
      <div id="como-funciona">
        {features.map((feature, index) => (
          <FeatureSection
            key={index}
            title={feature.title}
            description={feature.description}
            mockup={feature.mockup}
            reversed={feature.reversed}
            bullets={feature.bullets}
            ctaText={index === features.length - 1 ? "Começar agora" : undefined}
            ctaAction={index === features.length - 1 ? () => scrollToSection("precos") : undefined}
          />
        ))}
      </div>
      
      <Suspense fallback={<SectionSkeleton />}>
        <MetricasSection />
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton />}>
        <ParaQuemSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <DepoimentosSection />
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

