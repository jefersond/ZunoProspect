import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PERFIS_ALVO } from "./data";

export function ParaQuemSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="para-quem" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Para quem é</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Feito para quem vende serviços de marketing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Se você precisa de mais clientes para sua agência ou trabalho freelancer, essa ferramenta é para você.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERFIS_ALVO.map((perfil, index) => (
            <Card key={index} className="p-6 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 transition-all dark:border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                <perfil.icone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">{perfil.titulo}</h3>
              <ul className="space-y-3">
                {perfil.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Ver preços e planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
