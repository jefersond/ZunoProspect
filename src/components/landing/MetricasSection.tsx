import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { METRICAS } from "./data";

export function MetricasSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-primary py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center text-primary-foreground">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">
            Prospecção com menos achismo e mais contexto
          </h2>
          <p className="text-primary-foreground/80">
            Sem promessas infladas: o foco é reduzir busca manual, organizar leads e apoiar sua primeira abordagem.
          </p>
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {METRICAS.map((metrica) => (
            <div key={metrica.label} className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-5 text-center text-primary-foreground">
              <div className="mb-2 text-2xl font-bold">{metrica.numero}</div>
              <div className="mb-1 text-lg font-semibold">{metrica.label}</div>
              <div className="text-sm text-primary-foreground/75">{metrica.descricao}</div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Button size="lg" variant="secondary" onClick={() => scrollToSection("precos")}>
            Ver planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
