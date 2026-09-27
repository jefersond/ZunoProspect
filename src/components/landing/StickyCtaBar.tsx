import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { LANDING_CTA_BASE, LANDING_CTA_ICON } from "./ctaStyles";

interface StickyCtaBarProps {
  heroRef: React.RefObject<HTMLElement | null>;
}

export function StickyCtaBar({ heroRef }: StickyCtaBarProps) {
  const { trialDurationDays } = useBillingOfferConfig();

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [heroRef]);

  const handleClick = () => {
    trackEvent("cta_clicked", { cta: "comecar_primeira_busca", location: "sticky", cta_location: "sticky" });
    trackEvent("trial_cta_clicked", { cta_location: "sticky", cta_text: "Começar minha primeira busca", trial_duration_days: trialDurationDays });
    trackMetaCustomEvent("CTA_Sticky_Click", { page: "landing", location: "sticky_bar" });
    document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-[#20312A] bg-[#07100D]/95 backdrop-blur-md transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="hidden items-center gap-2 sm:flex">
          <ShieldCheck className="h-4 w-4 text-[#12D98B]" />
          <p className="text-sm text-[#A9B8B1]">
            <span className="font-semibold text-[#F3F7F5]">Zuno Propect</span>. {trialDurationDays ? `Teste grátis de ${trialDurationDays} dias. Hoje R$0.` : "Teste grátis. Hoje R$0."}
          </p>
        </div>
        <Button
          size="sm"
          className={`${LANDING_CTA_BASE} w-full bg-[#12D98B] text-[#07100D] shadow-[0_0_20px_rgba(18,217,139,0.3)] transition-all hover:scale-[1.02] hover:bg-[#21E6A0] sm:ml-auto sm:w-auto`}
          onClick={handleClick}
        >
          Começar minha primeira busca
          <ArrowRight className={LANDING_CTA_ICON} />
        </Button>
      </div>
    </div>
  );
}
