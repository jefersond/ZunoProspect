import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, ArrowRight, Building2 } from "lucide-react";
import { HERO_AVATARS } from "./data";
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
              <Button size="lg" className="text-base sm:text-lg px-6 sm:px-8 shadow-lg shadow-primary/25" onClick={() => scrollToSection("precos")}>
                Começar agora
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8" onClick={() => scrollToSection("como-funciona")}>
                Ver como funciona
              </Button>
            </div>

            
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl opacity-30 dark:opacity-50" />
            <Card className="relative border-2 shadow-2xl dark:border-border/50 dark:shadow-primary/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-sm text-muted-foreground">Prospecção com IA</span>
                </div>

                <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Buscar leads</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-background rounded border border-border/50 text-sm">🏙️ São Paulo</div>
                    <div className="p-2 bg-background rounded border border-border/50 text-sm">🏢 Restaurantes</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Leads encontrados</div>
                  {["Restaurante Sabor & Arte", "Bistrô da Vila", "Cantina Italiana"].map((nome, i) => <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{nome}</span>
                      </div>
                      <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">
                        {85 - i * 10}%
                      </Badge>
                    </div>)}
                </div>

                <div className="p-3 border border-primary/30 rounded-lg bg-primary/5 dark:bg-primary/10">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                    <Zap className="h-4 w-4" />
                    Plano de 7 dias gerado!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dia 1: WhatsApp • Dia 2: Email • Dia 3: WhatsApp...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>;
}