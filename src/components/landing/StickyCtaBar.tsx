import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

interface StickyCtaBarProps {
  heroRef: React.RefObject<HTMLElement | null>;
}

export function StickyCtaBar({ heroRef }: StickyCtaBarProps) {
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
    trackEvent("cta_clicked", { cta: "sticky_bar", location: "sticky" });
    trackMetaCustomEvent("CTA_Sticky_Click", { page: "landing", location: "sticky_bar" });
    document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-[#1f2d29] bg-[#0b0f0e]/95 backdrop-blur-md transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="hidden items-center gap-2 sm:flex">
          <ShieldCheck className="h-4 w-4 text-[#10d98a]" />
          <p className="text-sm text-[#9ca3af]">
            <span className="font-semibold text-[#f4f4f5]">Zuno Propect</span> · teste grátis de 7 dias · hoje R$0
          </p>
        </div>
        <Button
          size="sm"
          className="ml-auto h-10 rounded-lg bg-[#10d98a] px-6 font-bold text-[#0b0f0e] shadow-[0_0_20px_rgba(16,217,138,0.3)] hover:bg-[#10d98a]/90 hover:scale-[1.02] transition-all"
          onClick={handleClick}
        >
          Começar grátis agora
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
