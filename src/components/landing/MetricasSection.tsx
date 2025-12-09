import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { METRICAS } from "./data";

export function MetricasSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {METRICAS.map((metrica, index) => (
            <div key={index} className="text-center text-primary-foreground">
              <div className="text-5xl md:text-6xl font-bold mb-2">{metrica.numero}</div>
              <div className="text-xl font-semibold mb-1">{metrica.label}</div>
              <div className="text-primary-foreground/70 text-sm">{metrica.descricao}</div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Assinar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
