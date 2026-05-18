import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { appendReferralToPath } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";

export function CTAFinalSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-primary py-14 md:py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="mx-auto mb-4 max-w-3xl text-3xl font-bold text-primary-foreground md:text-5xl">
          Comece sua prospecção com mais clareza hoje.
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-primary-foreground/80 md:text-xl">
          Teste o Zuno com 20 leads grátis e 3 análises com IA.
        </p>
        <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <Button
            size="lg"
            className="h-14 w-full bg-primary-foreground px-8 text-base font-bold text-primary hover:bg-primary-foreground/90 sm:w-auto"
            onClick={() => trackEvent("cta_clicked", { cta: "comecar_gratis", location: "final_cta" })}
            asChild
          >
            <Link to={appendReferralToPath("/auth?tab=signup")}>
              Começar grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full border-primary-foreground/40 bg-transparent px-8 text-base text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "ver_planos", location: "final_cta" });
              scrollToSection("precos");
            }}
          >
            Ver planos
          </Button>
        </div>
      </div>
    </section>
  );
}
