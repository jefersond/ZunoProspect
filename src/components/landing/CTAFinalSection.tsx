import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Smartphone } from "lucide-react";
import { appendReferralToPath } from "@/lib/referral";

export function CTAFinalSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-primary to-primary/80">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4 sm:mb-6 text-center">
          Pare de ficar horas caçando clientes manualmente
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-10 text-center">
          Comece agora a prospectar com IA e tenha leads qualificados com planos de abordagem prontos em minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto shadow-lg shadow-primary/20"
            asChild
          >
            <Link to={appendReferralToPath("/auth?tab=signup")}>
              Começar agora
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base sm:text-lg px-6 sm:px-8 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto"
            asChild
          >
            <a href="https://wa.me/553298511685?text=Ol%C3%A1!%20Preciso%20de%20suporte%20com%20o%20Zuno%20Prospect." target="_blank" rel="noopener noreferrer">
              <Smartphone className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Falar com suporte
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
