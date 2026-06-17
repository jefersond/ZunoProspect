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
import { AntesDepoisSection } from "@/components/landing/AntesDepoisSection";
import { ComoFuncionaSection } from "@/components/landing/ComoFuncionaSection";
import { ParaQuemSection } from "@/components/landing/ParaQuemSection";
import { CasosDeUsoSection } from "@/components/landing/CasosDeUsoSection";


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
    <div className="dark min-h-screen overflow-x-hidden bg-[#0b0f0e] text-[#f4f4f5] selection:bg-[#10d98a]/30">
      <LPHeader />
      {hasReferralInvite && (
        <div className="border-b border-[#10d98a]/20 bg-[#10d98a]/10 px-4 py-3 text-center text-sm text-[#10d98a]">
          Você foi convidado para conhecer o Zuno Propect.
        </div>
      )}
      <HeroSection />
      
      <AntesDepoisSection />
      
      <ComoFuncionaSection />
      
      <ParaQuemSection />
      
      <CasosDeUsoSection />

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
