import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import screenshot04 from "@/assets/screenshots/screenshot-04.png";

export function HeroSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  return <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10 dark:from-background dark:via-primary/10 dark:to-accent/5 pt-24 pb-16 md:py-24">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl dark:bg-primary/20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl dark:bg-accent/15" />

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-6 md:space-y-8">
            <Badge variant="secondary" className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2">
              🚀 Feito para agências, gestores de tráfego e freelas de marketing
            </Badge>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Encontre clientes{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                prontos para comprar
              </span>{" "}
              seus serviços de marketing
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg">
              Prospecte leads qualificados em minutos. A IA analisa empresas, gera diagnósticos e cria planos de abordagem personalizados de 7 dias.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button size="lg" variant="success" className="text-base sm:text-lg px-6 sm:px-8" onClick={() => scrollToSection("precos")}>
                Começar Grátis
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8" onClick={() => scrollToSection("como-funciona")}>
                Ver como funciona
              </Button>
            </div>

            
          </div>

          <div className="relative hidden lg:block lg:scale-110 xl:scale-115">
            <div className="relative overflow-hidden rounded-xl border-2 border-border/50 shadow-2xl dark:shadow-primary/10 bg-card animate-fade-in">
              <img
                src={screenshot04}
                alt="Leads qualificados com análise IA"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>;
}