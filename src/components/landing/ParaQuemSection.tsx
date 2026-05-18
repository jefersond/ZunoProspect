import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { PERFIS_ALVO } from "./data";

export function ParaQuemSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="para-quem" className="bg-secondary/20 py-16 dark:bg-secondary/10 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <Badge variant="outline" className="mb-4">Para quem é</Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Feito para quem vende serviços B2B
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Se você precisa encontrar empresas e iniciar conversas comerciais, o Zuno ajuda a transformar cidade + nicho em oportunidades.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PERFIS_ALVO.map((perfil) => (
            <Card key={perfil.titulo} className="rounded-lg border-border/60 bg-background/80 p-6 transition-all hover:border-primary/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                <perfil.icone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{perfil.titulo}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{perfil.bullets[0]}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Começar grátis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
