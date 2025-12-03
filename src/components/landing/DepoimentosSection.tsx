import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { DEPOIMENTOS } from "./data";
import { LazyImage } from "./LazyImage";

export function DepoimentosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(DEPOIMENTOS.length / itemsPerPage);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % totalPages);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);

  const visibleDepoimentos = DEPOIMENTOS.slice(
    currentIndex * itemsPerPage,
    (currentIndex + 1) * itemsPerPage
  );

  return (
    <section id="depoimentos" className="py-20 bg-secondary/20 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Depoimentos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            O que outros profissionais de marketing estão dizendo
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja como a plataforma está ajudando agências e freelas a conseguir mais clientes.
          </p>
        </div>

        <div className="relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDepoimentos.map((depoimento) => (
              <Card key={depoimento.id} className="p-6 hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: depoimento.estrelas }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{depoimento.texto}"</p>
                <div className="flex items-center gap-4">
                  <LazyImage
                    src={depoimento.foto}
                    alt={depoimento.nome}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold">{depoimento.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {depoimento.cargo} • {depoimento.empresa}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-8">
              <Button variant="outline" size="icon" onClick={prevSlide}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
              <Button variant="outline" size="icon" onClick={nextSlide}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" onClick={() => scrollToSection("precos")}>
            Quero começar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
