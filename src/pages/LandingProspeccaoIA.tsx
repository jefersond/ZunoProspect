import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { LandingPageSkeleton } from "@/components/landing/LandingPageSkeleton";

// Critical components - loaded immediately
import { LPHeader } from "@/components/landing/LPHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { BeneficiosSection } from "@/components/landing/BeneficiosSection";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { MetricsCarousel } from "@/components/landing/MetricsCarousel";
import { FeatureSection } from "@/components/landing/FeatureSection";

// Screenshots for features
import screenshot01 from "@/assets/screenshots/screenshot-01.png";
import screenshot02 from "@/assets/screenshots/screenshot-02.png";
import screenshot03 from "@/assets/screenshots/screenshot-03.png";
import screenshot04 from "@/assets/screenshots/screenshot-04.png";
import screenshot05 from "@/assets/screenshots/screenshot-05.png";
import screenshot06 from "@/assets/screenshots/screenshot-06.png";
import screenshot07 from "@/assets/screenshots/screenshot-07.png";
import screenshot08 from "@/assets/screenshots/screenshot-08.png";

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
    image: screenshot01,
    imageAlt: "Formulário de busca de leads por nicho e cidade",
    bullets: [
      "Busca por nicho e localização",
      "Filtros avançados de qualificação",
      "Dados de contato verificados"
    ]
  },
  {
    title: "Diagnóstico completo de cada lead",
    description: "A IA analisa site, redes sociais, avaliações e gera uma pontuação de probabilidade de conversão para cada empresa.",
    image: screenshot05,
    imageAlt: "Card de lead com análise de IA e probabilidade de conversão",
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
    image: screenshot06,
    imageAlt: "Plano de prospecção de 7 dias com mensagens",
    bullets: [
      "Mensagens personalizadas por canal",
      "Sequência de 7 dias estruturada",
      "Scripts de follow-up inclusos"
    ]
  },
  {
    title: "Organize seus leads em um funil visual",
    description: "Arraste e solte leads entre etapas do pipeline. Nunca perca uma oportunidade de fechar negócio.",
    image: screenshot07,
    imageAlt: "Pipeline de vendas estilo Kanban",
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
    image: screenshot08,
    imageAlt: "Dashboard de relatórios e métricas",
    bullets: [
      "KPIs em tempo real",
      "Gráficos de performance",
      "Exportação de dados"
    ]
  },
  {
    title: "Salve e organize seus melhores leads",
    description: "Marque leads como favoritos e acesse rapidamente. Adicione notas e acompanhe todo o histórico de interações.",
    image: screenshot03,
    imageAlt: "Lista de leads salvos com filtros",
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
  }, [navigate]);

  if (isCheckingAuth) {
    return <LandingPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LPHeader />
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
            image={feature.image}
            imageAlt={feature.imageAlt}
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
