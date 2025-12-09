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

// Lazy loaded components - below the fold
const ComoFuncionaSection = lazy(() => import("@/components/landing/ComoFuncionaSection").then(m => ({
  default: m.ComoFuncionaSection
})));
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
const SectionSkeleton = () => <div className="py-16 flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>;
export default function LandingProspeccaoIA() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/prospeccao", {
          replace: true
        });
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect if checkout is in progress (PIX payment flow)
      const checkoutInProgress = sessionStorage.getItem("checkout_in_progress");
      if (session?.user && !checkoutInProgress) {
        navigate("/prospeccao", {
          replace: true
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  if (isCheckingAuth) {
    return <LandingPageSkeleton />;
  }
  return <div className="min-h-screen bg-background overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <BeneficiosSection />
      
      <Suspense fallback={<SectionSkeleton />}>
        <ComoFuncionaSection />
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton />}>
        
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton />}>
        <MetricasSection />
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton />}>
        <ParaQuemSection />
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
    </div>;
}